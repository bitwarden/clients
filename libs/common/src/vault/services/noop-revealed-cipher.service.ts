import { Observable, of } from "rxjs";

import { CipherId, UserId } from "../../types/guid";
import { RevealedCipherService } from "../abstractions/revealed-cipher.service";
import { CipherView } from "../models/view/cipher.view";

/** {@link RevealedCipherService} for clients without a licensed implementation. Reveals nothing. */
export class NoopRevealedCipherService implements RevealedCipherService {
  revealed$(): Observable<ReadonlyMap<CipherId, CipherView>> {
    return of(new Map());
  }

  isRevealed(): boolean {
    return false;
  }

  get(): CipherView | undefined {
    return undefined;
  }

  async getOrReveal(): Promise<CipherView | null> {
    return null;
  }

  async refresh(): Promise<void> {}

  displayView$(_userId: UserId, storedView: CipherView): Observable<CipherView> {
    return of(storedView);
  }
}
