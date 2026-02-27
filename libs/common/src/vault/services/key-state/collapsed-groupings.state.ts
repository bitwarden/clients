import { UserKeyDefinition, VAULT_FILTER_DISK } from "../../../platform/state";

export const COLLAPSED_GROUPINGS = UserKeyDefinition.array<string>(
  VAULT_FILTER_DISK,
  "collapsedGroupings",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout", "lock"],
  },
);
