import { Observable } from "rxjs";

import { CipherId, UserId } from "../../../../types/guid";

/** The user's per-cipher health report exclusions, read from cipher state and saved to the server. */
export abstract class CipherReportExclusionService {
  /** Ids of the user's ciphers excluded from health reports; empty while the exclusions flag is off. */
  abstract excludedCipherIds$(userId: UserId): Observable<ReadonlySet<string>>;

  /** Saves the exclusion on the server, then on this device. Rejects, and changes nothing, if the save fails. */
  abstract excludeWithServer(cipherId: CipherId, userId: UserId): Promise<void>;
}
