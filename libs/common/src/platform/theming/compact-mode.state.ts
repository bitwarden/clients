import { KeyDefinition, THEMING_DISK } from "@bitwarden/state";

export const COMPACT_MODE = new KeyDefinition<boolean>(THEMING_DISK, "compactMode", {
  deserializer: (s) => s,
});
