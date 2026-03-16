import { SdkRecordMapper } from "@bitwarden/common/platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "@bitwarden/common/platform/state";
import { EphemeralPinEnvelopeState } from "@bitwarden/sdk-internal";

import { PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL } from "./pin/pin.state";

export class EphemeralPinEnvelopeMapper implements SdkRecordMapper<
  EphemeralPinEnvelopeState,
  EphemeralPinEnvelopeState
> {
  userKeyDefinition(): UserKeyDefinition<Record<string, EphemeralPinEnvelopeState>> {
    return PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL;
  }

  toSdk(value: EphemeralPinEnvelopeState): EphemeralPinEnvelopeState {
    return value;
  }

  fromSdk(value: EphemeralPinEnvelopeState): EphemeralPinEnvelopeState {
    return value;
  }
}
