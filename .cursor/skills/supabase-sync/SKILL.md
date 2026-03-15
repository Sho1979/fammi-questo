# Supabase Sync — Fammi Questo

## Description
Guida l'implementazione del layer di sincronizzazione cifrato con Supabase per Fammi Questo. Include: schema DB Supabase (3 tabelle), Edge Functions, crittografia AES-256-GCM, e conflict resolution LWW.

## When to Use
Usa per Release R3 quando implementi: sincronizzazione tra dispositivi, crittografia dati, Edge Functions Supabase, Realtime events. Trigger: "sync", "supabase", "crittografia", "sincronizzazione", "edge function".

## ⚠️ ATTENZIONE
Questa skill è per R3 (Release 3). Non usarla prima di aver completato R1 e R2.
Verifica sempre in `3_BUILD_ORDER_CURSOR.md` che siamo negli step di R3.

## Instructions

### Architettura Sync (da 1_MASTER_ARCHITECTURE.md)
```
[Dexie.js] → cifra AES-256-GCM → [sync_blobs] → Supabase
[Supabase] → decifra → [Dexie.js] → Conflict Resolution LWW
```

### Schema Supabase (solo 3 tabelle!)
```sql
-- 1. Famiglie
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Membri (per auth)
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id),
  device_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Blob cifrati (UNICO punto di sync)
CREATE TABLE sync_blobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  encrypted_data BYTEA NOT NULL,  -- AES-256-GCM
  device_id TEXT NOT NULL,
  _version INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, table_name, record_id)
);
```

### Crittografia (da 5_API_CONTRACTS.md)
```typescript
// Formato blob: IV (12 bytes) + ciphertext
async function encrypt(data: object, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv);
  result.set(new Uint8Array(ciphertext), iv.length);
  return result.buffer;
}
```

### Conflict Resolution — LWW 3 livelli
```typescript
const remoteWins = !local
  || remote._version > local._version
  || (remote._version === local._version && remote.updated_at > local.updated_at)
  || (remote._version === local._version && remote.updated_at === local.updated_at
      && remote._device_id > local._device_id);
```

### Consulta sempre
- `1_MASTER_ARCHITECTURE.md` sezioni 5 (Security) e 6 (Sync)
- `5_API_CONTRACTS.md` per formati payload esatti
- `4_DATA_MODEL.md` per schema entità da sincronizzare
