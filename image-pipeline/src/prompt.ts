import configData from "../config/anime-cyberpunk.json" assert { type: "json" };
import { LayerResult } from "./types.js";

const cfg = configData as any;

/**
 * Build a final prompt string by replacing placeholders in the template with trait prompts.
 * If a trait is missing, the placeholder is replaced with an empty string.
 */
export function buildPrompt(traits: LayerResult): string {
  const template: string = cfg.prompt_template;
  // Map placeholders to the corresponding prompt strings
  const placeholderMap: Record<string, string> = {
    body: traits["Body"]?.prompt ?? "",
    clothing: traits["Clothing"]?.prompt ?? "",
    headwear: traits["Headwear"]?.prompt ?? "",
    eyes: traits["Eyes"]?.prompt ?? "",
    accessory: traits["Accessory"]?.prompt ?? "",
    aura: traits["Aura"]?.prompt ?? "",
    emblem: traits["Emblem"]?.prompt ?? "",
    signature_clause: traits["Signature"] ? ", " + traits["Signature"]!.prompt : ""
  };
  return template.replace(/\{(\w+)\}/g, (_, key: string) => placeholderMap[key] ?? "");
}