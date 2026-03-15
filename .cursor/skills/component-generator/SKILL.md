# Component Generator — Fammi Questo

## Description
Genera componenti React tipizzati per Fammi Questo seguendo le convenzioni del progetto. Ogni componente include TypeScript interfaces, Tailwind styling, Dexie.js integration, e test boilerplate.

## When to Use
Usa questa skill quando devi creare un nuovo componente React per il progetto Fammi Questo. Trigger: "crea componente", "genera componente", "nuovo componente", "new component".

## Instructions

### Step 1: Verifica prerequisiti
Prima di generare il componente:
1. Leggi `4_DATA_MODEL.md` per le interfacce TypeScript delle entità coinvolte
2. Leggi `3_BUILD_ORDER_CURSOR.md` per verificare che lo step corrente richieda questo componente
3. Verifica che il componente non esista già in `src/components/`

### Step 2: Struttura file
Crea i seguenti file:
```
src/components/{ComponentName}/
  ├── {ComponentName}.tsx       # Componente principale (max 150 righe)
  ├── {ComponentName}.test.tsx  # Test con Vitest + Testing Library
  └── index.ts                  # Re-export
```

### Step 3: Template componente
```tsx
import { FC } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';

interface {ComponentName}Props {
  familyId: string;
  // ... altre props tipizzate
}

const {ComponentName}: FC<{ComponentName}Props> = ({ familyId }) => {
  // Query reattiva Dexie
  const data = useLiveQuery(
    () => db.{tableName}
      .where('family_id').equals(familyId)
      .filter(item => !item._deleted)
      .toArray(),
    [familyId]
  );

  if (!data) return <div className="animate-pulse h-20 bg-gray-200 rounded-xl" />;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Contenuto componente */}
    </div>
  );
};

export default {ComponentName};
```

### Step 4: Convenzioni obbligatorie
- **Naming**: PascalCase per file e componente
- **Props**: Interfaccia esplicita con JSDoc per ogni prop
- **Loading state**: Skeleton con `animate-pulse`
- **Error boundary**: Wrappa in ErrorBoundary se ha fetch async
- **Accessibilità**: `aria-label` su elementi interattivi, touch target min 44px
- **Lingua**: UI in italiano, codice in inglese
- **Max righe**: 150 — se supera, split in sotto-componenti

### Step 5: Test boilerplate
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {ComponentName} from './{ComponentName}';

describe('{ComponentName}', () => {
  it('renders without crashing', () => {
    render(<{ComponentName} familyId="test-family" />);
    // Verifica rendering base
  });

  it('shows loading skeleton when data is undefined', () => {
    render(<{ComponentName} familyId="test-family" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
```
