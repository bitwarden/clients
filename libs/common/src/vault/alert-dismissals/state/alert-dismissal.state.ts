import { Jsonify } from "type-fest";

import { ALERT_DISMISSALS_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { AlertDismissalData } from "../../models/data/alert-dismissal.data";

export const ALERT_DISMISSALS = UserKeyDefinition.array<AlertDismissalData>(
  ALERT_DISMISSALS_DISK,
  "alertDismissals",
  {
    deserializer: (d: Jsonify<AlertDismissalData>) => AlertDismissalData.fromJSON(d),
    clearOn: ["logout"],
  },
);
