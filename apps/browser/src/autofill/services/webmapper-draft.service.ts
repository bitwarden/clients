import { distinctUntilChanged, firstValueFrom, map, Observable } from "rxjs";

import {
  GlobalState,
  KeyDefinition,
  StateProvider,
  WEBMAPPER_DISK,
} from "@bitwarden/common/platform/state";

import { emptyDraft, WebmapperDraft } from "../webmapper/draft";

// All drafts live under one global key as a record keyed by (host, pathname) —
// the same dynamically-keyed-record shape DomainSettingsService uses for its
// per-host maps. Global (not user-scoped): mapping public pages is unrelated to
// the vault user.
const WEBMAPPER_DRAFTS = new KeyDefinition<Record<string, WebmapperDraft>>(
  WEBMAPPER_DISK,
  "drafts",
  { deserializer: (value) => value ?? {} },
);

function keyFor(host: string, pathname: string | null): string {
  return `${host}|${pathname ?? "__HOST__"}`;
}

/**
 * Persists webmapper drafts in disk state, shared across the background (capture)
 * and the popup (review). Reactive `draft$` propagates background-driven captures
 * to an open panel.
 */
export class WebmapperDraftService {
  private readonly draftsState: GlobalState<Record<string, WebmapperDraft>>;

  constructor(stateProvider: StateProvider) {
    this.draftsState = stateProvider.getGlobal(WEBMAPPER_DRAFTS);
  }

  /** The draft for (host, pathname), emitting an empty draft when none is stored. */
  draft$(host: string, pathname: string | null): Observable<WebmapperDraft> {
    const key = keyFor(host, pathname);
    return this.draftsState.state$.pipe(
      map((drafts) => drafts?.[key]),
      // The record re-emits on any host's change; only re-emit when this key's
      // stored draft actually changed (avoids a fresh emptyDraft each tick).
      distinctUntilChanged(),
      map((stored) => stored ?? emptyDraft(host, pathname)),
    );
  }

  getDraft(host: string, pathname: string | null): Promise<WebmapperDraft> {
    return firstValueFrom(this.draft$(host, pathname));
  }

  async setDraft(draft: WebmapperDraft): Promise<void> {
    const key = keyFor(draft.host, draft.pathname);
    await this.draftsState.update((drafts) => ({ ...(drafts ?? {}), [key]: draft }));
  }

  /**
   * Applies `mutate` to the draft as it stands at write time. Prefer this over
   * read-then-{@link setDraft}: background capture and an open panel write the same
   * key, and a whole-draft write from an earlier read drops whatever landed between.
   *
   * `mutate` must be free of side effects — the state layer may re-invoke the update.
   */
  async updateDraft(
    host: string,
    pathname: string | null,
    mutate: (draft: WebmapperDraft) => void,
  ): Promise<WebmapperDraft> {
    const key = keyFor(host, pathname);
    let next!: WebmapperDraft;
    await this.draftsState.update((drafts) => {
      // Drafts persist as JSON, so this round-trip is a faithful deep copy.
      const current = drafts?.[key];
      next = current ? JSON.parse(JSON.stringify(current)) : emptyDraft(host, pathname);
      mutate(next);
      return { ...(drafts ?? {}), [key]: next };
    });
    return next;
  }

  async clearDraft(host: string, pathname: string | null): Promise<void> {
    const key = keyFor(host, pathname);
    await this.draftsState.update((drafts) => {
      if (!drafts || !(key in drafts)) {
        return drafts ?? {};
      }
      const next = { ...drafts };
      delete next[key];
      return next;
    });
  }
}
