import { CipherId } from "../../types/guid";

/** Whether the active user holds a live PAM lease on a cipher. */
export abstract class CipherLeaseStateService {
  abstract hasActiveLease(cipherId: CipherId): Promise<boolean>;
}
