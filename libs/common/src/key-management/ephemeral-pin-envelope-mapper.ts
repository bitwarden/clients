import { SdkRecordMapper } from "@bitwarden/common/platform/services/sdk/client-managed-state";
import { UserKeyDefinition } from "@bitwarden/common/platform/state";
import { EphemeralPinEnvelopeState, PasswordProtectedKeyEnvelope } from "@bitwarden/sdk-internal";

import { PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL } from "./pin/pin.state";

export class EphemeralPinEnvelopeMapper
  implements SdkRecordMapper<EphemeralPinEnvelopeState, PasswordProtectedKeyEnvelope>
{
  userKeyDefinition(): UserKeyDefinition<Record<string, EphemeralPinEnvelopeState>> {
    return PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL;
  }

  toSdk(value: EphemeralPinEnvelopeState): PasswordProtectedKeyEnvelope {
    return value.pin_envelope;
  }

  fromSdk(value: PasswordProtectedKeyEnvelope): EphemeralPinEnvelopeState {
    return { pin_envelope: value } as EphemeralPinEnvelopeState;
  }
}
