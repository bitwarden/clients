import { inject, Injectable, signal } from "@angular/core";
import { BehaviorSubject, distinctUntilChanged, Subscription, switchMap } from "rxjs";

import { CipherId } from "@bitwarden/common/types/guid";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { CipherShareAccess } from "@bitwarden/vault";

import { ShareItemService } from "./share-item.service";
import { ShareLinkService } from "./share-link.service";

/**
 * The most ciphers kept under watch at once. Rows on screen are read on every change detection, so
 * they stay warm. Ciphers scrolled out of view fall off the least-recently-read end.
 */
const MAX_TRACKED_CIPHERS = 200;

/** A cipher under watch: its latest view, and the subscription that answers for it. */
interface TrackedCipher {
  feed: BehaviorSubject<CipherViewLike>;
  subscription: Subscription;
}

/**
 * Provides {@link CipherShareAccess} to the vault row menu, built on {@link ShareLinkService}.
 *
 * The menu reads `canShare` synchronously, but the check is an observable. Each cipher gets one
 * subscription, and its latest answer is kept in a signal. Until that answer arrives `canShare`
 * returns `false`, so the action stays hidden rather than flashing in. Watching is bounded to
 * {@link MAX_TRACKED_CIPHERS}; a cipher evicted and read again is checked again.
 */
@Injectable({ providedIn: "root" })
export class CipherShareAccessService implements CipherShareAccess {
  private readonly shareLinkService = inject(ShareLinkService);
  private readonly shareItemService = inject(ShareItemService);

  /** The latest resolved answer per cipher. A signal, so a row re-renders when its answer lands. */
  private readonly answers = signal<ReadonlyMap<CipherId, boolean>>(new Map());

  /**
   * Ciphers under watch. Map iteration follows insertion order, so the first entry is the least
   * recently read; each read moves its entry to the end.
   */
  private readonly tracked = new Map<CipherId, TrackedCipher>();

  canShare(cipher: CipherViewLike): boolean {
    const id = CipherViewLikeUtils.getId(cipher);
    if (id == null) {
      return false;
    }

    // Tracking subscribes and writes a signal, which a template read must not do. Defer it.
    queueMicrotask(() => this.track(id, cipher));

    return this.answers().get(id) ?? false;
  }

  share(cipher: CipherViewLike): Promise<void> {
    return this.shareItemService.share(cipher);
  }

  private track(id: CipherId, cipher: CipherViewLike): void {
    const existing = this.tracked.get(id);
    if (existing) {
      // Move to the most-recently-read end before anything else can evict it.
      this.tracked.delete(id);
      this.tracked.set(id, existing);
      if (existing.feed.value !== cipher) {
        existing.feed.next(cipher);
      }
      return;
    }

    const feed = new BehaviorSubject<CipherViewLike>(cipher);
    const subscription = feed
      .pipe(
        switchMap((c) => this.shareLinkService.cipherCanBeShared$(c)),
        distinctUntilChanged(),
      )
      .subscribe((canShare) =>
        this.answers.update((answers) => new Map(answers).set(id, canShare)),
      );
    this.tracked.set(id, { feed, subscription });

    this.evictOverflow();
  }

  /** Stops watching the least-recently-read ciphers until the cap is respected. */
  private evictOverflow(): void {
    while (this.tracked.size > MAX_TRACKED_CIPHERS) {
      const oldest = this.tracked.entries().next();
      if (oldest.done) {
        return;
      }
      const [oldestId, entry] = oldest.value;
      entry.subscription.unsubscribe();
      this.tracked.delete(oldestId);
      this.answers.update((answers) => {
        const next = new Map(answers);
        next.delete(oldestId);
        return next;
      });
    }
  }
}
