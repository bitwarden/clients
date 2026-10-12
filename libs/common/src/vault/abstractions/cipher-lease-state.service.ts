import { CipherId } from "../../types/guid";

/** Which ciphers the active user holds a live PAM lease on. */
export abstract class CipherLeaseStateService {
  /** The subset of `cipherIds` under a live lease, looked up in one read. */
  abstract leasedCipherIds(cipherIds: CipherId[]): Promise<Set<CipherId>>;
}
