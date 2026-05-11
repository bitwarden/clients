import { inject, Injectable } from "@angular/core";
import { map, Observable, shareReplay } from "rxjs";

import { StateProvider } from "@bitwarden/common/platform/state";
import { FORK_LOCAL_CIPHER_TAGS } from "@bitwarden/common/vault/services/key-state/vault-settings.state";

/** Device-local cipher tags for the vault popup (fork feature; not synced to server). */
@Injectable({ providedIn: "root" })
export class ForkLocalCipherTagsService {
  private state = inject(StateProvider).getActive(FORK_LOCAL_CIPHER_TAGS);

  /** Map of cipher id → tag list */
  readonly tagsRecord$: Observable<Record<string, string[]>> = this.state.state$.pipe(
    map((record) => record ?? {}),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Parse comma-/semicolon-separated tags from UI text. */
  static parseCsv(input: string): string[] {
    if (!input?.trim()) {
      return [];
    }
    const parts = input.split(/[,;]/).map(ForkLocalCipherTagsService.normalize).filter(Boolean);
    return ForkLocalCipherTagsService.uniqueSorted(parts.map((t) => t!));
  }

  static serialize(tags: string[]): string {
    return ForkLocalCipherTagsService.uniqueSorted(
      tags.map((t) => ForkLocalCipherTagsService.normalize(t)).filter(Boolean) as string[],
    ).join(", ");
  }

  static normalize(tag: string | null | undefined): string | null {
    const t = tag?.trim().toLowerCase();
    return t?.length ? t : null;
  }

  async setTagsForCipher(cipherId: string, tags: string[]): Promise<void> {
    const normalized = ForkLocalCipherTagsService.uniqueSorted(
      tags.map((x) => ForkLocalCipherTagsService.normalize(x)).filter(Boolean) as string[],
    );
    await this.state.update((prev) => {
      const next = { ...(prev ?? {}) };
      if (normalized.length === 0) {
        delete next[cipherId];
      } else {
        next[cipherId] = normalized;
      }
      return next;
    });
  }

  async removeCipher(cipherId: string): Promise<void> {
    await this.state.update((prev) => {
      if (!prev?.[cipherId]) {
        return prev ?? {};
      }
      const next = { ...prev };
      delete next[cipherId];
      return next;
    });
  }

  private static uniqueSorted(tags: string[]): string[] {
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
  }
}
