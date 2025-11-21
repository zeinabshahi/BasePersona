// lib/traits.ts
import { SPECIES } from './species';

export type Metrics = {
  uniqueContracts?: number;
  activeDays?: number;
  gasEth?: number;
  monthlyRank?: number; // lower is better
  nftCount?: number;
  balanceEth?: number;
  totalTxs?: number;
};

export const THRESHOLDS = {
  uniqueContracts: [20, 50, 100, 200, 500, 1000],
  activeDays: [10, 20, 50, 100, 200, 500],
  gasEth: [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1],
  monthlyRank: [1000, 5000, 25000, 50000, 100000, 250000, 500000], // lower → better
  nftCount: [1, 10, 50, 100, 200, 500],
  balanceEth: [0.001, 0.002, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1],
  totalTxs: [100, 200, 500, 1000, 2000, 3000],
};

function bucketBySteps(value: number, steps: number[]) {
  // returns 0..steps.length, where k means value >= steps[k-1] and < steps[k] (except last)
  let idx = 0;
  for (const s of steps) {
    if (value >= s) idx++;
    else break;
  }
  return idx;
}
function bucketByStepsLowerIsBetter(value: number, steps: number[]) {
  // lower is better: idx increments while value <= step
  let idx = 0;
  for (const s of steps) {
    if (value <= s) idx++;
    else break;
  }
  return idx;
}

// نوع ساده برای species، فقط برای اینکه TS راضی بشه
type SpeciesId = string | number;

export type BuiltTraits = {
  version: 2;
  species: SpeciesId;
  styleLock: {
    camera: 'waist_up';
    lineStyle: 'bold_clean';
    background: 'solid';
    bgHex: string;
  };
  // tier indices (0..N) for debugging / UI
  tiers: {
    uniqueContracts: number;
    activeDays: number;
    gasEth: number;
    monthlyRank: number;
    nftCount: number;
    balanceEth: number;
    totalTxs: number;
  };
  // friendly names (optional UI)
  names: {
    headwear: string;
    eyes: string;
    clothing: string;
    accessory: string;
    emblem: string;
  };
  // prompt parts to be injected into the final prompt
  promptParts: {
    headwear: string;
    eyes: string;
    clothing: string;
    accessory: string;
    emblem: string;
  };
};

export function pickTraits(
  mIn: Metrics,
  species: SpeciesId
): BuiltTraits {
  const m = {
    uniqueContracts: Number(mIn.uniqueContracts ?? 0),
    activeDays: Number(mIn.activeDays ?? 0),
    gasEth: Number(mIn.gasEth ?? 0),
    monthlyRank: Number(mIn.monthlyRank ?? 99999999),
    nftCount: Number(mIn.nftCount ?? 0),
    balanceEth: Number(mIn.balanceEth ?? 0),
    totalTxs: Number(mIn.totalTxs ?? 0),
  };

  const tContracts = bucketBySteps(m.uniqueContracts, THRESHOLDS.uniqueContracts);
  const tActive = bucketBySteps(m.activeDays, THRESHOLDS.activeDays);
  const tGas = bucketBySteps(m.gasEth, THRESHOLDS.gasEth);
  const tRank = bucketByStepsLowerIsBetter(m.monthlyRank, THRESHOLDS.monthlyRank);
  const tNft = bucketBySteps(m.nftCount, THRESHOLDS.nftCount);
  const tBal = bucketBySteps(m.balanceEth, THRESHOLDS.balanceEth);
  const tTxs = bucketBySteps(m.totalTxs, THRESHOLDS.totalTxs);

  // — mapping tiers → friendly names + prompt phrases (minimal anime style) —
  const headwearNames = [
    'Bare',
    'Field Beanie',
    'Multi-Tool Cap',
    'Pro Visor',
    'Vanguard Helmet',
    'Omni Headdress',
    'Prime Crown',
  ];
  const headwearPrompts = [
    'no headwear',
    'soft beanie hat, minimal logo',
    'futuristic baseball cap, thin seams',
    'sleek tech visor, subtle glow trim',
    'light battle helmet, smooth plates',
    'ornate cyber headdress, simple geometry',
    'minimal crown band, very thin',
  ];
  const eyesNames = [
    'Bare Eyes',
    'Clear Glasses',
    'Tinted Glasses',
    'Tech Specs',
    'HUD Visor',
    'Full AR Visor',
    'Prime AR Visor',
  ];
  const eyesPrompts = [
    'natural anime eyes, glossy highlight',
    'thin clear glasses, subtle reflection',
    'tinted lenses, light reflection',
    'smart glasses, faint UI glyphs',
    'curved HUD visor, soft icons',
    'full AR visor, restrained UI',
    'full AR visor, clean icon band',
  ];
  const clothingNames = [
    'Linen Tee',
    'Canvas Jacket',
    'Leather Vest',
    'Alloy Armor',
    'Composite Suit',
    'Mythic Plate',
    'Prime Plate',
  ];
  const clothingPrompts = [
    'minimal tech tee',
    'light canvas jacket, clean seams',
    'sleek leather vest',
    'light alloy chest piece, tiny accents',
    'composite suit with very subtle panels',
    'ornate plate, restrained gold lines',
    'hero plate, very clean panels',
  ];
  const accessoryNames = [
    'Mono Pin',
    'Dual Scarf',
    'Mosaic Pendant',
    'Kaleido Strap',
    'Prism Harness',
    'Spectrum Orbs',
    'Prime Orbs',
  ];
  const accessoryPrompts = [
    'small chest pin',
    'simple woven scarf',
    'small pendant, faint glow',
    'cross-body strap, neat cells',
    'thin prism harness',
    'two floating orbs near shoulders',
    'three floating orbs near shoulders',
  ];
  const emblemNames = [
    'None',
    'Tin Ring',
    'Bronze Circlet',
    'Silver Crest',
    'Gold Diadem',
    'Platinum Halo',
    'Prime Halo',
    'Legend Halo',
  ];
  const emblemPrompts = [
    'no emblem',
    'thin ring above head',
    'thin bronze circlet',
    'small silver crest above head',
    'small gold diadem above head',
    'thin platinum halo',
    'slightly brighter platinum halo',
    'bright but thin halo',
  ];

  const headwearIdx = Math.min(tContracts, headwearPrompts.length - 1);
  const eyesIdx = Math.min(tActive, eyesPrompts.length - 1);
  const clothingIdx = Math.min(tTxs, clothingPrompts.length - 1);
  const accessoryIdx = Math.min(Math.max(tNft, tBal), accessoryPrompts.length - 1);
  const emblemIdx = Math.min(tRank, emblemPrompts.length - 1);

  // SPECIES احتمالاً یک آبجکت/آرایه با bgHex است؛ به any کست می‌کنیم که TS ایراد نگیرد
  const bgHex =
    (SPECIES as any)?.[species]?.bgHex ??
    '#020617';

  return {
    version: 2,
    species,
    styleLock: {
      camera: 'waist_up',
      lineStyle: 'bold_clean',
      background: 'solid',
      bgHex,
    },
    tiers: {
      uniqueContracts: tContracts,
      activeDays: tActive,
      gasEth: tGas,
      monthlyRank: tRank,
      nftCount: tNft,
      balanceEth: tBal,
      totalTxs: tTxs,
    },
    names: {
      headwear: headwearNames[headwearIdx],
      eyes: eyesNames[eyesIdx],
      clothing: clothingNames[clothingIdx],
      accessory: accessoryNames[accessoryIdx],
      emblem: emblemNames[emblemIdx],
    },
    promptParts: {
      headwear: headwearPrompts[headwearIdx],
      eyes: eyesPrompts[eyesIdx],
      clothing: clothingPrompts[clothingIdx],
      accessory: accessoryPrompts[accessoryIdx],
      emblem: emblemPrompts[emblemIdx],
    },
  };
}
