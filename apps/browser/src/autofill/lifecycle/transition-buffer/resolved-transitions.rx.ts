import { Observable, OperatorFunction, Subscription } from "rxjs";

import { cancellationToken } from "../../utils/cancellation";

import { endResolvedPageTransition } from "./actions";
import type {
  BufferedTransitionReport,
  PageTransitionSignals,
  ResolvedTransitionReport,
} from "./types";

/** Identifies the frame of a tab, and the top frame, which has no id. */
const frameKey = (frameId: number | undefined): number => frameId ?? -1;

/** What the operator keeps of the latest resolved transition of a frame. */
type Live = Readonly<{ cancel: () => void; stampedAt: number }>;

/**
 * Hands each transition the buffer resolved on as a {@link ResolvedTransitionReport}, with a token
 * that is cancelled when the transition expires. A transition expires when the release that hot
 * gave it ends: its tab leaves hot, its tab is removed, or a newer transition for its frame
 * resolves. It also expires when the transitions it follows end, or fail, because nothing is left
 * to say that it is still released. The deadline does not expire it: whoever acts on the transition
 * refuses one that is past its deadline.
 *
 * The older transition expires before the newer one is emitted, so a newer transition is never
 * cancelled by its own resolution. A transition that is older than the latest of its frame, as one
 * restored from storage after a fresh one, is not emitted: an older transition never replaces a
 * newer one.
 *
 * The operator keeps what it needs for each subscription. It subscribes to the resolved transitions
 * before the signals, so the controller reacts to a signal before this operator does. Nothing here
 * depends on that order.
 */
export function resolvedTransitions(
  signals: Pick<PageTransitionSignals, "tabLifecycleChanged$" | "tabRemoved$">,
): OperatorFunction<BufferedTransitionReport, ResolvedTransitionReport> {
  return (resolved$) =>
    new Observable<ResolvedTransitionReport>((subscriber) => {
      /** The latest resolved transition of each frame, by tab. */
      const live = new Map<number, Map<number, Live>>();

      const expireTab = (tabId: number) => {
        live.get(tabId)?.forEach(({ cancel }) => cancel());
        live.delete(tabId);
      };

      const subscription = new Subscription();
      subscription.add(
        resolved$.subscribe({
          next: ({ userId, tabId, frameId, documentId, url, expiresAt, stampedAt }) => {
            const frames = live.get(tabId) ?? new Map<number, Live>();
            const latest = frames.get(frameKey(frameId));
            if (latest !== undefined && stampedAt < latest.stampedAt) {
              return;
            }
            live.set(tabId, frames);
            // the older transition expires before the newer one is announced
            latest?.cancel();
            const { cancel, token } = cancellationToken();
            frames.set(frameKey(frameId), { cancel, stampedAt });
            subscriber.next({
              userId,
              tabId,
              frameId,
              documentId,
              url,
              expiresAt,
              cancellation: token,
            });
          },
          error: (error: unknown) => subscriber.error(error),
          complete: () => subscriber.complete(),
        }),
      );
      subscription.add(
        signals.tabLifecycleChanged$.subscribe(([tabId, edge]) => {
          if (endResolvedPageTransition(edge)) {
            expireTab(tabId);
          }
        }),
      );
      subscription.add(signals.tabRemoved$.subscribe(expireTab));

      return () => {
        subscription.unsubscribe();
        [...live.keys()].forEach(expireTab);
      };
    });
}
