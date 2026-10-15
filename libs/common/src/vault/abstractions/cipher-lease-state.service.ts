import { Observable } from "rxjs";

import { UserId } from "../../types/guid";
import { Cipher } from "../models/domain/cipher";

/** The ciphers the active user holds a live PAM lease on. */
export abstract class CipherLeaseStateService {
  abstract leasedCipherIds(): Promise<Set<string>>;
  /**
   * Encrypted full copies of the gated ciphers the user holds a live lease on. They never enter
   * the cipher repository or disk, and {@link CipherService} joins them only into lookups a user
   * starts.
   */
  abstract leasedCiphers$(userId: UserId): Observable<Cipher[]>;
}
