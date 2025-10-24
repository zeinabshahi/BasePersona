// Type definitions for wallet inputs and trait selection

/**
 * Shape of the wallet metrics used for selecting traits. Many fields are
 * optional because not all on-chain analytics may be available. Numeric
 * properties default to zero if undefined.
 */
export interface WalletInput {
  address: string;
  wallet_birth_month?: number;
  wallet_age_days?: number;
  unique_contracts: number;
  active_days: number;
  total_txs: number;
  distinct_tokens: number;
  dex_trades?: number;
  nft_mints?: number;
  holds_builder?: boolean;
  holds_introduced?: boolean;
}

/**
 * A trait pick describes a single trait selected from the config. It
 * contains the display name and the prompt snippet associated with that
 * trait. Undefined picks indicate missing or unknown traits.
 */
export interface TraitPick {
  name: string;
  prompt: string;
}

/**
 * Mapping of layer names to trait picks. The key is the human-friendly
 * layer name defined in the configuration and the value is the TraitPick
 * chosen for that layer, or undefined if none is chosen.
 */
export type LayerResult = Record<string, TraitPick | undefined>;

/**
 * Mapping of layer names to the trait names (as strings) chosen from the
 * configuration. This is used for computing hashes and determining when
 * signature traits should be added.
 */
export type LayerNames = Record<string, string>;