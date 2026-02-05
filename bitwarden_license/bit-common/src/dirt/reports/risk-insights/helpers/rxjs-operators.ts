import { catchError, of, OperatorFunction, throwError, timeout, TimeoutError } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

/**
 * RxJS operator that handles 404 errors by returning null.
 * All other errors are re-thrown.
 *
 * @example
 * ```typescript
 * this.apiService.get$('/api/resource').pipe(
 *   handle404AsNull()
 * )
 * // Returns: Observable<T | null>
 * ```
 */
export const handle404AsNull = <T>(): OperatorFunction<T, T | null> =>
  catchError((error: unknown) => {
    if (error instanceof ErrorResponse && error.statusCode === 404) {
      return of(null);
    }
    return throwError(() => error);
  });

/**
 * RxJS operator that adds a timeout with a custom error message.
 *
 * @param ms - Timeout duration in milliseconds
 * @param contextMessage - Custom error message to throw on timeout
 *
 * @example
 * ```typescript
 * this.apiService.post$('/api/large-upload', data).pipe(
 *   timeoutWithContext(120000, 'Upload timeout: The file may be too large.')
 * )
 * ```
 */
export const timeoutWithContext = <T>(ms: number, contextMessage: string): OperatorFunction<T, T> =>
  timeout({
    each: ms,
    with: () => throwError(() => new Error(contextMessage)),
  });

/**
 * RxJS operator that enriches errors with additional context.
 * Handles TimeoutError and ErrorResponse specially, providing detailed error messages.
 *
 * @param context - Context string to prepend to error messages
 *
 * @example
 * ```typescript
 * this.apiService.post$('/api/save', data).pipe(
 *   enrichError('Failed to save report')
 * )
 * // Errors become: "Failed to save report: <original message> (Status: 500)"
 * ```
 */
export const enrichError = <T>(context: string): OperatorFunction<T, T> =>
  catchError((error: unknown) => {
    // Handle timeout errors
    if (error instanceof TimeoutError) {
      return throwError(() => new Error(`${context}: Request timed out`));
    }

    // Handle API error responses with status codes
    if (error instanceof ErrorResponse) {
      return throwError(
        () => new Error(`${context}: ${error.message} (Status: ${error.statusCode})`),
      );
    }

    // Handle generic errors
    return throwError(
      () => new Error(`${context}: ${error instanceof Error ? error.message : "Unknown error"}`),
    );
  });

/**
 * RxJS operator that combines timeout with error enrichment.
 * Convenience operator for common API call patterns.
 *
 * @param ms - Timeout duration in milliseconds
 * @param timeoutMessage - Message for timeout errors
 * @param errorContext - Context for other errors
 *
 * @example
 * ```typescript
 * this.apiService.post$('/api/save', data).pipe(
 *   timeoutAndEnrichError(
 *     120000,
 *     'Request timeout: The server did not respond within 2 minutes.',
 *     'Failed to save report'
 *   )
 * )
 * ```
 */
export const timeoutAndEnrichError = <T>(
  ms: number,
  timeoutMessage: string,
  errorContext: string,
): OperatorFunction<T, T> =>
  catchError((error: unknown) => {
    // Handle timeout errors with custom message
    if (error instanceof TimeoutError) {
      return throwError(() => new Error(timeoutMessage));
    }

    // Handle API error responses
    if (error instanceof ErrorResponse) {
      return throwError(
        () => new Error(`${errorContext}: ${error.message} (Status: ${error.statusCode})`),
      );
    }

    // Handle generic errors
    return throwError(
      () =>
        new Error(`${errorContext}: ${error instanceof Error ? error.message : "Unknown error"}`),
    );
  });
