/** Handler that may finish synchronously or return a promise. */
export type AsyncHandler<TArgs extends unknown[] = []> = (
  ...args: TArgs
) => unknown | Promise<unknown>;

// eslint-disable-next-line no-console -- default until the host app registers its handler
let errorHandler: (error: unknown) => void = (error) => console.error(error);

/** Called once by the host application, e.g. to show a toast for failed actions. */
export function setAsyncActionErrorHandler(handler: (error: unknown) => void) {
  errorHandler = handler;
}

/**
 * Runs `handler`, reporting `loading` around it. Errors are routed to the app's error handler
 * instead of being thrown, matching `bitAction`'s behavior.
 */
export async function runAsyncAction<TArgs extends unknown[]>(
  handler: AsyncHandler<TArgs> | undefined,
  setLoading: (loading: boolean) => void,
  ...args: TArgs
): Promise<void> {
  if (!handler) {
    return;
  }
  setLoading(true);
  try {
    await handler(...args);
  } catch (error) {
    errorHandler(error);
  } finally {
    setLoading(false);
  }
}
