import { Observable } from "rxjs";

import { CipherId, UserId } from "../../types/guid";
import { CipherView } from "../models/view/cipher.view";

/**
 * Full views of restricted ciphers. A licensed feature implements it. The default reveals nothing.
 *
 * Every implementation must follow these rules:
 * - Never write a view to disk, encrypted or decrypted. Keep decrypted views in process memory.
 *   Processes of one client can share an encrypted copy through session memory state (a
 *   `"memory"` `StateDefinition`). Never use `"memory-large-object"`: the MV3 browser backs it with
 *   disk.
 * - Clear a user's views and shared copies when that user leaves the unlocked state or logs out,
 *   in every process.
 * - Return only full (not partial) views whose `id` is the requested cipher.
 * - Never return a view after its reveal ends.
 */
export abstract class RevealedCipherService {
  /** The live revealed views of the user, by cipher ID. */
  abstract revealed$(userId: UserId): Observable<ReadonlyMap<CipherId, CipherView>>;
  /** True while a live revealed view exists. */
  abstract isRevealed(userId: UserId, cipherId: CipherId): boolean;
  abstract get(userId: UserId, cipherId: CipherId): CipherView | undefined;
  /** The revealed view; reveals first if the user may reveal it now. For edit and deep links. */
  abstract getOrReveal(userId: UserId, cipherId: CipherId): Promise<CipherView | null>;
  /** Reveals again (after a save). Drops the view if the user may no longer reveal it. */
  abstract refresh(userId: UserId, cipherId: CipherId): Promise<void>;
  /** The revealed view while one exists, else `storedView`. Item-view hosts read this. */
  abstract displayView$(userId: UserId, storedView: CipherView): Observable<CipherView>;
}
