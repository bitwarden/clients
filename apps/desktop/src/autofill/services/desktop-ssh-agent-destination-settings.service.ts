import { map, Observable } from "rxjs";

import { CipherId } from "@bitwarden/common/types/guid";
import { SshAgentDestinationSettingsService } from "@bitwarden/vault";

import { SshAgentDestinationsService } from "./ssh-agent-destinations.service";

/**
 * Desktop implementation of {@link SshAgentDestinationSettingsService}, backed by the existing
 * {@link SshAgentDestinationsService} local-state service. This is the only concrete provider of
 * the abstraction today — other clients don't provide it, so the shared cipher form UI stays
 * hidden there.
 */
export class DesktopSshAgentDestinationSettingsService extends SshAgentDestinationSettingsService {
  constructor(private sshAgentDestinationsService: SshAgentDestinationsService) {
    super();
  }

  destinationFingerprints$(cipherId: CipherId): Observable<string[]> {
    return this.sshAgentDestinationsService.destinationFingerprints$.pipe(
      map((all) => all[cipherId] ?? []),
    );
  }

  setDestinationFingerprints(cipherId: CipherId, fingerprints: string[]): Promise<void> {
    return this.sshAgentDestinationsService.setDestinationFingerprints(cipherId, fingerprints);
  }
}
