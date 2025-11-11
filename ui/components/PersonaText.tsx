// components/PersonaText.tsx
'use client';

import React from 'react';

type PersonaCopy = {
  title?: string;
  oneLiner?: string;
  summary?: string;
  highlights?: string[];
};

export function PersonaText({ narrative, isLoading }: { narrative?: any; isLoading?: boolean }) {
  if (isLoading) {
    return <div style={{opacity:.75}}>Generating persona…</div>;
  }
  const src = (narrative?.narrativeJson || narrative || {}) as PersonaCopy;

  return (
    <div>
      {src.title && <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>{src.title}</div>}
      {src.oneLiner && <div style={{ fontWeight: 600, marginBottom: 8 }}>{src.oneLiner}</div>}
      {src.summary && <p style={{ margin: 0 }}>{src.summary}</p>}
      {Array.isArray(src.highlights) && src.highlights.length > 0 && (
        <ul style={{ marginTop: 12 }}>
          {src.highlights.map((h, i) => <li key={i}>{h}</li>)}
        </ul>
      )}
    </div>
  );
}

export default PersonaText;
