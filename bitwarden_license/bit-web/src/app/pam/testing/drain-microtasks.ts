/**
 * Settle a promise chain under fake timers, where `setTimeout(…, 0)` no longer runs on its own.
 *
 * Ten turns rather than one: the pipelines these specs drive (`getCipherAccessState` → rxjs →
 * another promise) queue several microtasks deep, and awaiting a single turn drains only the
 * first. Ten is comfortably past the deepest chain and costs nothing when the queue is already
 * empty.
 */
export async function drainMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}
