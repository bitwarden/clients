import { Observable } from "rxjs";

import { usingDisposable } from "../../rx/using-disposable";

import { ResilientTransitionBuffer } from "./resilient-buffer";
import { resolvedTransitions } from "./resolved-transitions.rx";
import { TransitionBufferController } from "./transition-buffer-controller";
import type {
  PageTransitionDependencies,
  PageTransitionSignals,
  ResolvedTransitionReport,
} from "./types";

/**
 * Builds the resolver of page transitions from what is fixed for the life of the extension: where
 * the buffer is stored, the clock, the age bound, and what to do when storage fails. The resolver
 * takes the signals, once they are in place, and returns the page transitions that resolved into a
 * fill opportunity, each with the token that is cancelled when it expires. See `model.md`.
 *
 * The stream is cold, and each subscription is a buffer with its own controller that ends with the
 * subscription. Subscribe once: a stored buffer has one writer.
 */
export function pageTransitionResolver(
  dependencies: PageTransitionDependencies,
): (signals: PageTransitionSignals) => Observable<ResolvedTransitionReport> {
  return (signals) =>
    usingDisposable(
      () =>
        new ResilientTransitionBuffer(
          dependencies.stateProvider,
          dependencies.now,
          dependencies.onStorageFailure,
        ),
      (buffer) =>
        usingDisposable(
          () =>
            new TransitionBufferController(signals, buffer, {
              now: dependencies.now,
              maxAgeMs$: dependencies.maxAgeMs$,
            }),
          (controller) => controller.resolved$,
        ),
    ).pipe(resolvedTransitions(signals));
}
