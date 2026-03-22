/**
 * Supabase Edge Function: receipt-ocr
 * Extracts products from receipt photos using Claude Haiku Vision.
 *
 * Input:  { image: base64_string, media_type: "image/jpeg" }
 * Output: { ok: true, products: [{name, quantity, price, category}] }
 *
 * Deploy: supabase functions deploy receipt-ocr
 * Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Content-Type": "application/json",
  };
}

const SYSTEM_PROMPT = `Sei un assistente specializzato nell'analisi di scontrini italiani.
Analizza l'immagine dello scontrino e estrai TUTTI i prodotti acquistati.

Per ogni prodotto restituisci:
- name: nome del prodotto (pulito, senza codici o abbreviazioni incomprensibili)
- quantity: quantità (numero, default 1)
- price: prezzo unitario in euro (numero con decimali, null se non leggibile)
- category: una di queste categorie: latticini, carne, pesce, verdura, frutta, pane, pasta, condimenti, bevande, igiene, surgelati, casa, dolci, altro

REGOLE:
1. Ignora righe come TOTALE, SUBTOTALE, IVA, CONTANTE, RESTO, data, indirizzo negozio
2. Se un prodotto ha quantità > 1 (es. "LATTE x3"), riporta quantity: 3
3. Se il prezzo ha la virgola (es. 2,50), convertilo in punto decimale (2.50)
4. Normalizza i nomi: "MOZZ.BUF.CAMP." → "Mozzarella di bufala campana"
5. Se non riesci a leggere il nome, scrivi il testo originale
6. Categorie: latticini (latte, formaggi, yogurt), carne (manzo, pollo, maiale),
   pesce, verdura, frutta, pane (pane, grissini), pasta (pasta, riso, farina),
   condimenti (olio, aceto, sale, spezie), bevande (acqua, succhi, vino, birra),
   igiene (sapone, shampoo, detersivo), surgelati, casa (carta, stoviglie),
   dolci (biscotti, cioccolato, gelato), altro (tutto il resto)

RISPONDI SOLO con JSON valido:
{
  "products": [
    { "name": "Latte intero", "quantity": 1, "price": 1.29, "category": "latticini" },
    { "name": "Pane integrale", "quantity": 1, "price": 2.10, "category": "pane" }
  ],
  "store": "nome negozio se visibile",
  "total": 25.40,
  "date": "2026-03-22"
}`;

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  // ── JWT verification ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing authorization", code: "AUTH_MISSING" }),
      { status: 401, headers: corsHeaders }
    );
  }

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    console.warn(`[AUTH] receipt-ocr rejected: ${authError?.message || "no user"}`);
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid or expired token", code: "AUTH_INVALID" }),
      { status: 401, headers: corsHeaders }
    );
  }

  console.info(`[AUDIT] receipt-ocr called by user=${user.id}`);

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "API key mancante — configura ANTHROPIC_API_KEY" }),
      { status: 500, headers: corsHeaders }
    );
  }

  // Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "JSON body non valido" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { image, media_type } = body;

  if (!image || typeof image !== "string") {
    return new Response(
      JSON.stringify({ ok: false, error: "Campo 'image' (base64) richiesto" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const validMediaTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const mType = media_type || "image/jpeg";
  if (!validMediaTypes.includes(mType)) {
    return new Response(
      JSON.stringify({ ok: false, error: `Tipo immagine non supportato: ${mType}` }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Size check: max 5MB base64 (~3.75MB image)
  if (image.length > 5 * 1024 * 1024) {
    return new Response(
      JSON.stringify({ ok: false, error: "Immagine troppo grande (max 5MB)" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // Call Claude Vision API
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mType,
                  data: image,
                },
              },
              {
                type: "text",
                text: "Analizza questo scontrino ed estrai tutti i prodotti.",
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error("Anthropic Vision API error:", anthropicResponse.status, errText);
      return new Response(
        JSON.stringify({ ok: false, error: `Errore AI Vision (HTTP ${anthropicResponse.status})` }),
        { status: 502, headers: corsHeaders }
      );
    }

    const result = await anthropicResponse.json();
    const aiText = result.content?.[0]?.text ?? "";

    // Clean markdown wrapper
    const cleaned = aiText
      .replace(/^```json\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      const products = (parsed.products || []).filter(
        (p: any) => p.name && typeof p.name === "string" && p.name.trim().length > 0
      );

      // Normalize products
      const normalized = products.map((p: any) => ({
        name: p.name.trim(),
        quantity: typeof p.quantity === "number" && p.quantity > 0 ? p.quantity : 1,
        price: typeof p.price === "number" && p.price > 0 ? Math.round(p.price * 100) / 100 : null,
        category: p.category || "altro",
      }));

      console.info(`[OCR] Extracted ${normalized.length} products from receipt`);

      return new Response(
        JSON.stringify({
          ok: true,
          products: normalized,
          store: parsed.store || null,
          total: typeof parsed.total === "number" ? parsed.total : null,
          date: parsed.date || null,
        }),
        { headers: corsHeaders }
      );
    } catch {
      console.error("Failed to parse Vision response:", cleaned.slice(0, 200));
      return new Response(
        JSON.stringify({ ok: false, error: "Risposta AI non valida — riprova con una foto più chiara" }),
        { status: 422, headers: corsHeaders }
      );
    }
  } catch (err: any) {
    console.error("receipt-ocr error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: `Errore interno: ${err.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
});
