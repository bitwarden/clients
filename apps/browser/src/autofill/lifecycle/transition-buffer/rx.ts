import {
  concatMap,
  defer,
  from,
  ignoreElements,
  merge,
  Observable,
  OperatorFunction,
  tap,
} from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { AccountEventKind } from "../enums";
import type { AccountEvent } from "../types";

import { TransitionBuffer } from "./abstractions";
import type { BufferSources } from "./types";

/**
 * Feeds a buffer from its sources. Subscribe to run; it emits nothing.
 *
 * `enabled$` is subscribed first, so a value it has on subscription is applied before any report.
 */
export function feedTransitionBuffer(
  buffer: TransitionBuffer,
  sources: BufferSources,
): Observable<never> {
  return merge(
    sources.enabled$.pipe(tap((enabled) => buffer.setEnabled(enabled))),
    sources.report$.pipe(tap((report) => buffer.report(report))),
    sources.tabLifecycleChanged$.pipe(tap(([tabId, edge]) => buffer.lifecycleChanged(tabId, edge))),
    sources.frameLost$.pipe(tap(({ tabId, frameId }) => buffer.frameLost(tabId, frameId))),
    sources.tabRemoved$.pipe(tap((tabId) => buffer.tabRemoved(tabId))),
  ).pipe(ignoreElements());
}

/**
 * The `enabled$` signal for a `TransitionBuffer`, from `accountEvents$`: `true` while the active
 * account is signed in, whether locked or unlocked; `false` otherwise.
 *
 * Its first value comes at `bootstrapped` and is the starting state, `false` included, so the
 * buffer can tell a start with nobody signed in from a later sign-in. After that it emits only
 * when the value flips, or for a lock of the active account or a switch while enabled, which emit
 * `false` then `true` synchronously: the buffer discards what it gathered before and keeps
 * gathering after. Nothing between this operator and the buffer may collapse the pair with
 * `distinctUntilChanged`.
 */
export function bufferEnabled(): OperatorFunction<AccountEvent, boolean> {
  return (event$) =>
    defer(() => {
      let active: UserId | null = null;
      const signedIn = new Set<UserId>();
      let bootstrapped = false;
      let enabled = false;

      const signals = (event: AccountEvent): boolean[] => {
        if (event.kind === AccountEventKind.Bootstrapped) {
          bootstrapped = true;
          return [enabled];
        }

        const wasEnabled = enabled;
        if (event.kind === AccountEventKind.Login) {
          signedIn.add(event.userId);
        } else if (event.kind === AccountEventKind.Logout) {
          signedIn.delete(event.userId);
        } else if (event.kind === AccountEventKind.Switch) {
          active = event.to;
        }
        enabled = active !== null && signedIn.has(active);

        if (!bootstrapped) {
          return [];
        }
        const cleared =
          event.kind === AccountEventKind.Switch ||
          (event.kind === AccountEventKind.Lock && event.userId === active);
        if (cleared && wasEnabled && enabled) {
          return [false, true];
        }
        return enabled === wasEnabled ? [] : [enabled];
      };

      return event$.pipe(concatMap((event) => from(signals(event))));
    });
}
