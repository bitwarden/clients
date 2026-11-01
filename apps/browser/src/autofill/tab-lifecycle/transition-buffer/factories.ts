import { defer, finalize, merge, Observable } from "rxjs";

import { StateProvider } from "@bitwarden/state";

import { DefaultTransitionBuffer } from "./default";
import { BUFFERED_TRANSITIONS, PersistentTransitionBuffer } from "./persistent";
import { BufferSources, feedTransitionBuffer } from "./rx";
import type { BufferedTransitionReport } from "./types";

/**
 * A {@link DefaultTransitionBuffer}, fed from its sources and kept in memory only.
 *
 * @param sources.now Epoch ms: the same clock `registerTransition` is stamped from.
 * @returns Each report that resolved into a fill opportunity. Resolution does not check that the
 * document is still live, nor that its account is the active one; the consumer checks both before
 * acting.
 */
export function transitionBuffer$(
  sources: BufferSources & { now: () => number },
): Observable<BufferedTransitionReport> {
  return defer(() => {
    const buffer = new DefaultTransitionBuffer(sources.now);
    return merge(buffer.resolved$, feedTransitionBuffer(buffer, sources)).pipe(
      finalize(() => buffer[Symbol.dispose]()),
    );
  });
}

/**
 * A {@link PersistentTransitionBuffer}, fed from its sources.
 *
 * Cold, and every subscription writes the same global record: subscribe once.
 *
 * @param sources.stateProvider Where the buffer is stored.
 * @param sources.now Epoch ms: the same clock `registerTransition` is stamped from.
 * @returns Each report that resolved into a fill opportunity. Resolution does not check that the
 * document is still live, nor that its account is the active one; the consumer checks both before
 * acting. Errors when storage fails.
 */
export function persistentTransitionBuffer$(
  sources: BufferSources & { stateProvider: StateProvider; now: () => number },
): Observable<BufferedTransitionReport> {
  return defer(() => {
    const buffer = new PersistentTransitionBuffer(
      sources.stateProvider.getGlobal(BUFFERED_TRANSITIONS),
      sources.now,
    );
    return merge(buffer.resolved$, feedTransitionBuffer(buffer, sources)).pipe(
      finalize(() => buffer[Symbol.dispose]()),
    );
  });
}
