export type FetchFn = (request: Request) => Promise<Response>;
export type FetchMiddleware = (request: Request, next: FetchFn) => Promise<Response>;

/**
 * Composes an array of middlewares into a single {@link FetchFn} by chaining them
 * in order around a terminal fetch function. The first middleware in the array is
 * the outermost (called first, returns last), and each middleware's `next` parameter
 * invokes the next middleware in the chain, with the terminal as the innermost call.
 *
 * @param middlewares - Middlewares to compose, applied first-to-last (outermost-to-innermost).
 * @param terminal - The final fetch call invoked at the end of the chain (typically `nativeFetch`).
 * @returns A single {@link FetchFn} representing the full pipeline.
 */
export function buildFetchPipeline(middlewares: FetchMiddleware[], terminal: FetchFn): FetchFn {
  return middlewares.reduceRight<FetchFn>(
    (next, middleware) => (request) => middleware(request, next),
    terminal,
  );
}
