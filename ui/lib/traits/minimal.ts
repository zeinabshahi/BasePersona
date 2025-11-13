// lib/traits/minimal.ts
import type { SpeciesId } from '../species';
import { SPECIES_CUES } from '../species';

export type TraitSlot =
  | 'Background' | 'Body' | 'Aura' | 'Headwear' | 'Eyes'
  | 'Clothing' | 'Accent' | 'Accessory' | 'Emblem';

export type TraitPrompt = { slot: TraitSlot; name: string; prompt: string };

export type TraitSelectionLite = {
  version: '1.3-lite';
  layerOrder: TraitSlot[];
  traits: Record<TraitSlot, TraitPrompt>;
  styleLock: {
    camera: 'waist-up';
    lighting: 'minimal_anime';
    bgMode: 'solid_pastel';
    bgColorHex: string;
    species: SpeciesId;
  };
};

export type TraitMetricsLite = {
  unique_contracts?: number; // Headwear        — stops: 20 50 100 200 500 1000
  active_days?: number;      // Eyes            — stops: 10 20 50 100 200 500
  gas_eth?: number;          // Aura            — stops: 0.001 0.002 0.005 0.01 0.02 0.05 0.1
  rank_monthly?: number;     // Emblem (low is better) — ceilings: 1000 5000 25000 50000 100000 250000 500000
  nft_count?: number;        // Accessory       — stops: 1 10 50 100 200 500
  balance_eth?: number;      // Accent          — stops: 0.001 0.002 0.01 0.02 0.05 0.1 0.2 0.5 1
  total_txs?: number;        // Clothing        — stops: 100 200 500 1000 2000 3000
  species?: SpeciesId;       // background pastel + subject cue
};

const nz = (x?: number) => (Number.isFinite(Number(x)) ? Number(x) : 0);

function idxByFlooredStops(v: number, stopsAsc: number[]) {
  let idx = 0;
  for (let i = 0; i < stopsAsc.length; i++) {
    if (v >= stopsAsc[i]) idx = i + 1; else break;
  }
  return idx; // 0 .. stops.length
}

function idxByRankBetterLow(v: number, ceilingsAsc: number[]) {
  for (let i = 0; i < ceilingsAsc.length; i++) {
    if (v <= ceilingsAsc[i]) return i;
  }
  return ceilingsAsc.length;
}

export function selectTraitsLite(m: TraitMetricsLite): TraitSelectionLite {
  const uniq = nz(m.unique_contracts);
  const act  = nz(m.active_days);
  const gas  = nz(m.gas_eth);
  const rnk  = nz(m.rank_monthly);
  const nfts = nz(m.nft_count);
  const bal  = nz(m.balance_eth);
  const txs  = nz(m.total_txs);
  const sp   = (m.species || 'fox') as SpeciesId;
  const pastelHex = SPECIES_CUES[sp]?.pastelHex || '#E6F0FF';

  // Headwear ⇐ Unique Contracts
  const HEAD_STOPS = [20, 50, 100, 200, 500, 1000];
  const HEAD_NAMES = ['Rookie Hair','Field Beanie','Multi-Tool Cap','Pro Visor','Vanguard Helmet','Omni Headdress','Crowned Headdress'] as const;
  const HEAD_DESC: Record<(typeof HEAD_NAMES)[number], string> = {
    'Rookie Hair':'simple clean anime haircut, tidy strands',
    'Field Beanie':'soft beanie, minimal logo',
    'Multi-Tool Cap':'futuristic baseball cap, subtle plates, neat seams',
    'Pro Visor':'sleek tech visor, thin trim',
    'Vanguard Helmet':'angular minimalist helmet, clean planes',
    'Omni Headdress':'ornate slim headdress, floating slim pieces',
    'Crowned Headdress':'minimal crown-like headdress, very clean silhouette',
  };
  const headName = HEAD_NAMES[idxByFlooredStops(uniq, HEAD_STOPS)];

  // Eyes ⇐ Active Days
  const EYE_STOPS = [10, 20, 50, 100, 200, 500];
  const EYE_NAMES = ['Bare Eyes','Clear Glasses','Tinted Glasses','Tech Specs','HUD Visor','Full AR Visor','Holo Array'] as const;
  const EYE_DESC: Record<(typeof EYE_NAMES)[number], string> = {
    'Bare Eyes':'natural anime eyes, glossy highlights',
    'Clear Glasses':'thin transparent glasses, modern minimal frame',
    'Tinted Glasses':'soft tinted lenses, simple reflection',
    'Tech Specs':'minimal smart glasses with tiny HUD hints',
    'HUD Visor':'clean curved visor, small UI glyphs',
    'Full AR Visor':'full-face minimalist AR visor',
    'Holo Array':'tiny floating UI dots near eyes, very subtle',
  };
  const eyeName = EYE_NAMES[idxByFlooredStops(act, EYE_STOPS)];

  // Aura ⇐ Gas Paid (ETH)
  const AURA_STOPS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1];
  const AURA_NAMES = ['Genesis Spark','Soft Flux','Neon Whirl','Pulse Field','Arc Storm','Ion Surge','Nova Bloom','Singularity Halo'] as const;
  const AURA_DESC: Record<(typeof AURA_NAMES)[number], string> = {
    'Genesis Spark':'very faint white rim light',
    'Soft Flux':'soft glow, minimal particles',
    'Neon Whirl':'thin orbiting line, subtle',
    'Pulse Field':'single clean pulse ring',
    'Arc Storm':'few crisp arcs, minimal',
    'Ion Surge':'denser glow, still clean',
    'Nova Bloom':'bright bloom, restrained',
    'Singularity Halo':'tight intense halo, minimal fringes',
  };
  const auraName = AURA_NAMES[idxByFlooredStops(gas, AURA_STOPS)];

  // Emblem ⇐ Monthly Rank (کمتر بهتر)
  const RANK_CEILINGS = [1000, 5000, 25000, 50000, 100000, 250000, 500000];
  const EMBLEM_NAMES = ['Platinum Halo','Gold Diadem','Silver Crest','Bronze Circlet','Tin Ring','Null Band','Null Band+','Null Band++'] as const;
  const EMBLEM_DESC: Record<(typeof EMBLEM_NAMES)[number], string> = {
    'Platinum Halo':'thin platinum halo, very clean',
    'Gold Diadem':'simple gold diadem, small',
    'Silver Crest':'small silver crest',
    'Bronze Circlet':'narrow bronze circlet',
    'Tin Ring':'thin pale ring, subtle',
    'Null Band':'no crown, clean head silhouette',
    'Null Band+':'no crown, faint rim light',
    'Null Band++':'no crown, almost no highlight',
  };
  const emblemName = EMBLEM_NAMES[idxByRankBetterLow(rnk, RANK_CEILINGS)];

  // Accessory ⇐ NFT (count)
  const NFT_STOPS = [1, 10, 50, 100, 200, 500];
  const ACC_NAMES = ['Mono Stripe Pin','Dual Weave Scarf','Mosaic Pendant','Kaleido Bandolier','Prism Mesh Harness','Spectrum Ornaments','Orbiting Badges'] as const;
  const ACC_DESC: Record<(typeof ACC_NAMES)[number], string> = {
    'Mono Stripe Pin':'small chest pin, single color',
    'Dual Weave Scarf':'simple two-tone scarf',
    'Mosaic Pendant':'tiny geometric pendant',
    'Kaleido Bandolier':'clean cross-body strap',
    'Prism Mesh Harness':'minimal harness, few lines',
    'Spectrum Ornaments':'two small floating dots',
    'Orbiting Badges':'three tiny orbiting badges',
  };
  const accName = ACC_NAMES[idxByFlooredStops(nfts, NFT_STOPS)];

  // Clothing ⇐ Total Transactions
  const TX_STOPS = [100, 200, 500, 1000, 2000, 3000];
  const CLOTH_NAMES = ['Basic Tee','Light Jacket','Utility Hoodie','Tech Shell','Composite Coat','Hero Coat','Prime Suit'] as const;
  const CLOTH_DESC: Record<(typeof CLOTH_NAMES)[number], string> = {
    'Basic Tee':'minimal fitted tee, flat shading',
    'Light Jacket':'light jacket, clean panels',
    'Utility Hoodie':'plain hoodie, tidy cords',
    'Tech Shell':'sleek shell jacket, few seams',
    'Composite Coat':'long coat, straight lines',
    'Hero Coat':'structured coat, minimal lapels',
    'Prime Suit':'clean suit, crisp edges',
  };
  const clothName = CLOTH_NAMES[idxByFlooredStops(txs, TX_STOPS)];

  // Accent ⇐ Balance (ETH)
  const BAL_STOPS = [0.001,0.002,0.01,0.02,0.05,0.1,0.2,0.5,1];
  const ACCENT_NAMES = ['No Accent','Thin Stripe','Pocket Line','Cuff Trim','Shoulder Piping','Panel Piping','Edge Binding','Dual Binding','Iridescent Edge','Gold Edge'] as const;
  const ACCENT_DESC: Record<(typeof ACCENT_NAMES)[number], string> = {
    'No Accent':'no extra trim',
    'Thin Stripe':'one thin stripe on sleeve',
    'Pocket Line':'single pocket line',
    'Cuff Trim':'simple cuff trim',
    'Shoulder Piping':'minimal shoulder piping',
    'Panel Piping':'few panel-edge lines',
    'Edge Binding':'clean edge binding',
    'Dual Binding':'double edge binding',
    'Iridescent Edge':'subtle iridescent edge',
    'Gold Edge':'thin gold edge line',
  };
  const accentName = ACCENT_NAMES[idxByFlooredStops(bal, BAL_STOPS)];

  const traits: Record<TraitSlot, TraitPrompt> = {
    Background: { slot:'Background', name:'Solid Pastel', prompt:`flat solid pastel background, ${pastelHex}, no texture, no gradient` },
    Body:       { slot:'Body',       name:'Humanoid Minimal', prompt:'humanoid athletic build, clean cartoon/anime face' },
    Aura:       { slot:'Aura',       name:auraName,    prompt:AURA_DESC[auraName] },
    Headwear:   { slot:'Headwear',   name:headName,    prompt:HEAD_DESC[headName] },
    Eyes:       { slot:'Eyes',       name:eyeName,     prompt:EYE_DESC[eyeName] },
    Clothing:   { slot:'Clothing',   name:clothName,   prompt:CLOTH_DESC[clothName] },
    Accent:     { slot:'Accent',     name:accentName,  prompt:ACCENT_DESC[accentName] },
    Accessory:  { slot:'Accessory',  name:accName,     prompt:ACC_DESC[accName] },
    Emblem:     { slot:'Emblem',     name:emblemName,  prompt:EMBLEM_DESC[emblemName] },
  };

  return {
    version: '1.3-lite',
    layerOrder: ['Background','Body','Aura','Headwear','Eyes','Clothing','Accent','Accessory','Emblem'],
    traits,
    styleLock: {
      camera: 'waist-up',
      lighting: 'minimal_anime',
      bgMode: 'solid_pastel',
      bgColorHex: pastelHex,
      species: sp,
    },
  };
}
