import { filter, map, merge, Observable, scan } from "rxjs";

import type { UserId } from "@bitwarden/common/types/guid";

import { AccountEventKind } from "../enums";
import type { AccountEvent } from "../types";

import { CompletionScopeKind } from "./enums";
import type { CompletionScope, CompletionSignals } from "./types";

/** What the end of a session is judged from. */
type Session = Readonly<{
  /** The active account, once a switch has said which it is. */
  active: UserId | undefined;
  /** Whether the first observation of the accounts has been reported. */
  bootstrapped: boolean;
  /** Whether the event just applied ended the session. */
  ended: boolean;
}>;

/**
 * The completions of the lifecycles of frames, tabs, and the session, as they occur. See `model.md`.
 *
 * Nothing is replayed: each completion is stated once, to the subscribers present when it occurs.
 * Subscribe before the signals begin, and only once: each subscription would state each completion again.
 */
export function lifecycleCompletions(signals: CompletionSignals): Observable<CompletionScope> {
  return merge(
    signals.tabRemoved$.pipe(
      map((tabId): CompletionScope => ({ kind: CompletionScopeKind.Tab, tabId })),
    ),
    signals.frameLost$.pipe(
      map(({ tabId, frameId }): CompletionScope => ({
        kind: CompletionScopeKind.Frame,
        tabId,
        frameId,
      })),
    ),
    sessionEnds$(signals.accountEvents$),
  );
}

/**
 * Each moment the active account's session ends: it locks, logs out, or stops being active. Events
 * in the accounts' first observation describe the accounts as found, so none of them ends a
 * session.
 */
function sessionEnds$(accountEvents$: Observable<AccountEvent>): Observable<CompletionScope> {
  return accountEvents$.pipe(
    scan((session: Session, event): Session => applyToSession(session, event), {
      active: undefined,
      bootstrapped: false,
      ended: false,
    }),
    filter(({ ended }) => ended),
    map((): CompletionScope => ({ kind: CompletionScopeKind.All })),
  );
}

/**
 * A switch, or a lock or logout of the active account, ends the session once the first observation
 * is over. Any other event, including the end of the first observation, leaves the session not
 * ended.
 */
function applyToSession(session: Session, event: AccountEvent): Session {
  switch (event.kind) {
    case AccountEventKind.Switch:
      return { ...session, active: event.to, ended: session.bootstrapped };

    case AccountEventKind.Lock:
    case AccountEventKind.Logout:
      return { ...session, ended: session.bootstrapped && event.userId === session.active };

    case AccountEventKind.Bootstrapped:
      return { ...session, bootstrapped: true, ended: false };

    case AccountEventKind.Login:
    case AccountEventKind.Unlock:
      return { ...session, ended: false };
  }
}
