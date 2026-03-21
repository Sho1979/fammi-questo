/**
 * Supabase Edge Function: brain-parse
 * Parses free-text Italian input into structured family app actions using Claude Haiku.
 * See 5_API_CONTRACTS.md §1 for request/response format.
 *
 * Deploy: supabase functions deploy brain-parse
 * Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;

const ALLOWED_ORIGINS = [
  "http://localhost:5173",       // dev
  "https://localhost",           // Capacitor iOS/Android
  "capacitor://localhost",       // Capacitor iOS
  "http://localhost",            // Capacitor Android
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

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "API key mancante — configura ANTHROPIC_API_KEY" }),
      { status: 500, headers: corsHeaders }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "JSON body non valido" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { text, context, localAttempt } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: "Testo vuoto" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const systemPrompt = buildSystemPrompt(context || {});
  const userMessage = buildUserMessage(text.slice(0, 500), localAttempt);

  try {
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
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error("Anthropic API error:", anthropicResponse.status, errText);
      return new Response(
        JSON.stringify({ ok: false, error: `Errore AI (HTTP ${anthropicResponse.status})` }),
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
      if (!parsed.actions || !Array.isArray(parsed.actions)) {
        throw new Error("No actions array");
      }

      // Validate action types
      const validTypes = ["task", "calendar", "expense", "meal", "shopping", "note"];
      const validActions = parsed.actions.filter(
        (a: any) => a.type && validTypes.includes(a.type)
      );

      // Validate expenses have positive amounts (reverse loop to safely splice)
      for (let i = validActions.length - 1; i >= 0; i--) {
        if (validActions[i].type === "expense") {
          validActions[i].amount = parseFloat(validActions[i].amount) || 0;
          if (validActions[i].amount <= 0) {
            validActions.splice(i, 1);
          }
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          actions: validActions,
          summary: parsed.summary ?? `${validActions.length} azioni trovate`,
        }),
        { headers: corsHeaders }
      );
    } catch {
      // Fallback: save as note
      return new Response(
        JSON.stringify({
          ok: true,
          actions: [{ type: "note", text: text.slice(0, 500), originalFragment: text.slice(0, 500) }],
          summary: "Non ho capito — salvato come nota",
        }),
        { headers: corsHeaders }
      );
    }
  } catch (err: any) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: `Errore interno: ${err.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
});

/**
 * Build user message for L3. If there's a local attempt (disambiguation mode),
 * include it as context so Haiku can confirm/correct rather than re-parsing from scratch.
 */
function buildUserMessage(text: string, localAttempt: any): string {
  if (!localAttempt || !localAttempt.actions?.length) return text;

  const attemptSummary = localAttempt.actions
    .map(
      (a: any, i: number) =>
        `  ${i + 1}. type="${a.type}" title="${a.title || a.name || ""}" conf=${((localAttempt.confidence || 0) * 100).toFixed(0)}%`
    )
    .join("\n");

  return `MESSAGGIO UTENTE: "${text}"

IL SISTEMA LOCALE HA TENTATO DI PARSARE MA CON CONFIDENZA BASSA (${((localAttempt.confidence || 0) * 100).toFixed(0)}%):
${attemptSummary}

Verifica e correggi il parsing locale, oppure fai un nuovo parsing se è completamente sbagliato.`;
}

function buildSystemPrompt(context: any): string {
  const members: any[] = context.members || [];
  const categories: string[] = context.categories || [];
  const meals: string[] = context.meals || [];
  const today = context.today || new Date().toISOString().slice(0, 10);
  const dayName = context.day_name || "";

  const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().slice(0, 10);
  const personsStr = members.map((m: any) => `${m.name} (${m.role})`).join(", ");
  const parentNames = members
    .filter((m: any) => m.role === "parent" || m.role === "elder" || m.role === "genitore")
    .map((m: any) => m.name);
  const categoriesStr = categories.join(", ") || "alimentari, trasporto, bollette, salute, scuola, svago, altro";

  return `Sei il cervello di un'app famiglia italiana. Parsi messaggi vocali/testo in azioni strutturate JSON.

OGGI: ${today} (${dayName})
DOMANI: ${tomorrow}
PERSONE FAMIGLIA: ${personsStr || "nessuna"}
GENITORI: ${parentNames.join(", ") || "nessuno"}
CATEGORIE SPESA: ${categoriesStr}
PIATTI CONOSCIUTI: ${meals.join(", ") || "nessuno"}

REGOLE DI PARSING:
1. Un messaggio può contenere MULTIPLE azioni — estraile TUTTE
2. Tipi azione: "task", "calendar", "expense", "meal", "shopping", "note"
3. Se una persona è nominata prima di un'azione, quell'azione è per lei
4. "stasera prepara X" → task cucina + meal (il piatto)
5. "domani alle 16 dentista" → calendar con time
6. "45 euro alimentari" → expense con amount e category
7. Se non capisci → "note" con il testo originale
8. Date: "domani"=${tomorrow}, "oggi"=${today}, "stasera"=${today}
9. Giorni settimana (lunedì, martedì...) → calcola la data corretta
10. "porta [persona]" → accompaniedBy nel calendar
11. "riprende [persona]" → pickupBy nel calendar
12. accompaniedBy e pickupBy DEVONO essere genitori: ${parentNames.join(", ")}
13. Ogni azione con data DEVE avere campo "date" in YYYY-MM-DD
14. "compra X" o "prendi X" → shopping
15. Per expense: amount DEVE essere numero positivo, category dalla lista

RISPONDI SOLO con JSON valido:
{
  "actions": [
    { "type": "task", "title": "...", "assignedTo": "Nome", "date": "YYYY-MM-DD" },
    { "type": "calendar", "title": "...", "assignedTo": "Nome", "date": "YYYY-MM-DD", "time": "HH:mm", "accompaniedBy": "Nome", "pickupBy": "Nome" },
    { "type": "expense", "amount": 45.00, "category": "alimentari", "note": "...", "person": "Nome", "date": "YYYY-MM-DD" },
    { "type": "meal", "name": "...", "date": "YYYY-MM-DD" },
    { "type": "shopping", "name": "...", "quantity": 1, "unit": "pz" },
    { "type": "note", "text": "..." }
  ],
  "summary": "2 task, 1 evento, 1 spesa"
}`;
}
