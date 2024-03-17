import { KeyDefinition, VAULT_FILTER_DISK } from "../../../platform/state";

export const COLLAPSED_GROUPINGS = KeyDefinition.array<string>(
  VAULT_FILTER_DISK,
  "collapsedGroupings",
  {
    deserializer: (obj) => obj,
  },
);
