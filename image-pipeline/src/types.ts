export interface WalletInput {
  address: string;
  /**
   * Month of the first transaction (1..12).  If undefined, gender defaults to Male.
   */
  wallet_birth_month?: number;
  /** Number of days since the wallet was created or first seen. */
  wallet_age_days?: number;
  /** Unique smart contracts the wallet has interacted with. */
  unique_contracts: number;
  /** Number of distinct days the wallet has been active. */
  active_days: number;
  /** Total transaction count. */
  total_txs: number;
  /** Number of different ERC20 tokens the wallet has interacted with. */
  distinct_tokens: number;
  /** Total volume (ETH). */
  volume_eth: number;
  /** Whether the wallet holds the Base Introduced NFT. */
  holds_base_introduced: boolean;
  /** Whether the wallet holds the Base Builder NFT. */
  holds_base_builder: boolean;
}

export interface TraitPick {
  name: string;
  prompt: string;
}

export type LayerResult = Record<string, TraitPick | undefined>;

export interface CollectionConfig {
  meta: any;
  prompt_template: string;
  rules: any;
  layers: any[];
  postprocess: {
    background_rule: string;
    assets: Record<string, string>;
    logo: {
      path: string;
      anchor: "top-right" | "top-left" | "bottom-right" | "bottom-left";
      padding: number;
      scale: number;
      opacity: number;
    };
    composite: {
      canvas_size: [number, number];
      align: string;
      subject_scale: number;
      subject_shadow: {
        enabled: boolean;
        type: string;
        blur: number;
        opacity: number;
        offsetY: number;
      };
      aura_blend_hint: string;
    };
  };
}