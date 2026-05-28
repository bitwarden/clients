import { Jsonify } from "type-fest";

import { ALERT_EXCLUSIONS_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { AlertExclusionData } from "../../models/data/alert-exclusion.data";

export const ALERT_EXCLUSIONS = UserKeyDefinition.array<AlertExclusionData>(
  ALERT_EXCLUSIONS_DISK,
  "alertExclusions",
  {
    deserializer: (d: Jsonify<AlertExclusionData>) => AlertExclusionData.fromJSON(d),
    clearOn: ["logout"],
  },
);
