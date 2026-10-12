/** The ciphers the active user holds a live PAM lease on. */
export abstract class CipherLeaseStateService {
  abstract leasedCipherIds(): Promise<Set<string>>;
}
