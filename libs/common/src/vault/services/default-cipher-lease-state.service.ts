import { CipherId } from "../../types/guid";
import { CipherLeaseStateService } from "../abstractions/cipher-lease-state.service";

/** Clients without a PAM lease source grant no leases, so gated ciphers stay read-only. */
export class DefaultCipherLeaseStateService implements CipherLeaseStateService {
  leasedCipherIds(): Promise<Set<CipherId>> {
    return Promise.resolve(new Set());
  }
}
