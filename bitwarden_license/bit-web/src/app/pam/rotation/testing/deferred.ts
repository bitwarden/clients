/**
 * A promise plus the handle that settles it, for holding a stubbed request in flight while the
 * spec makes a second call against it.
 */
export function deferred(): { promise: Promise<void>; settle: () => void } {
  let settle!: () => void;
  const promise = new Promise<void>((resolve) => (settle = resolve));
  return { promise, settle };
}
