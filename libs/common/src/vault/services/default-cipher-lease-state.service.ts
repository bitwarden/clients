import { Observable, of } from "rxjs";

import { CipherLeaseStateService } from "../abstractions/cipher-lease-state.service";
import { Cipher } from "../models/domain/cipher";

/** Clients without a PAM lease source grant no leases, so gated ciphers stay read-only. */
export class DefaultCipherLeaseStateService implements CipherLeaseStateService {
  leasedCipherIds(): Promise<Set<string>> {
    return Promise.resolve(new Set());
  }

  leasedCiphers$(): Observable<Cipher[]> {
    return of([]);
  }
}
