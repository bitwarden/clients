import { Observable } from "rxjs";

import { CipherId, UserId } from "../../../../types/guid";

/** The user's per-cipher health report exclusions, read from cipher state and saved to the server. */
export abstract class CipherReportExclusionService {
  /** Ids of the user's ciphers excluded from health reports; empty while the exclusions flag is off. */
  abstract excludedCipherIds$(userId: UserId): Observable<ReadonlySet<string>>;

  /** Saves on the server, then locally; rejects without a local change if the save fails. */
  abstract excludeWithServer(cipherId: CipherId, userId: UserId): Promise<void>;
}
