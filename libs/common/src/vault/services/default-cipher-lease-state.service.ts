import { CipherLeaseStateService } from "../abstractions/cipher-lease-state.service";

/** Clients without a PAM lease source grant no leases, so gated ciphers stay read-only. */
export class DefaultCipherLeaseStateService implements CipherLeaseStateService {
  hasActiveLease(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
