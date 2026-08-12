import { map } from "rxjs";

import {
  AUTOFILL_SETTINGS_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { CipherId } from "@bitwarden/common/types/guid";

const SSH_AGENT_DESTINATION_FINGERPRINTS = UserKeyDefinition.record<string[], CipherId>(
  AUTOFILL_SETTINGS_DISK,
  "sshAgentDestinationFingerprints",
  {
    deserializer: (fingerprints: string[]) => fingerprints,
    clearOn: [],
  },
);

/**
 * Desktop-local, per-cipher SSH-agent destination host-key fingerprints.
 *
 * When a key has one or more configured fingerprints, the native SSH agent only offers it for
 * connections whose verified `session-bind@openssh.com` destination host key matches one of them.
 * This preference is never synced — it exists only on this Desktop installation.
 */
export class SshAgentDestinationsService {
  private state = this.stateProvider.getActive(SSH_AGENT_DESTINATION_FINGERPRINTS);

  destinationFingerprints$ = this.state.state$.pipe(map((value) => value ?? {}));

  constructor(private stateProvider: StateProvider) {}

  async setDestinationFingerprints(cipherId: CipherId, fingerprints: string[]): Promise<void> {
    await this.state.update((current) => {
      const updated = { ...(current ?? {}) };

      if (fingerprints.length === 0) {
        delete updated[cipherId];
      } else {
        updated[cipherId] = fingerprints;
      }

      return updated;
    });
  }
}
