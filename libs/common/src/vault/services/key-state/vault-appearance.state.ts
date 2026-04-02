import { KeyDefinition, VAULT_APPEARANCE } from "@bitwarden/state";

export type CopyButtonDisplayMode = "combined" | "quick";

export const COPY_BUTTON = new KeyDefinition<CopyButtonDisplayMode>(
  VAULT_APPEARANCE,
  "copyButtons",
  {
    deserializer: (s) => s,
  },
);
