import { EphemeralPinEnvelopeState } from "@bitwarden/sdk-internal";

import { SdkRecordMapper } from "../platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "../platform/state";

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
