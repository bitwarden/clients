import { delay, of, throwError, TimeoutError } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import {
  enrichError,
  handle404AsNull,
  timeoutAndEnrichError,
  timeoutWithContext,
} from "./rxjs-operators";

describe("RxJS Operators", () => {
  describe("handle404AsNull", () => {
    it("should return null when error is 404", (done) => {
      const error404 = new ErrorResponse({ message: "Not Found" }, 404);

      throwError(() => error404)
        .pipe(handle404AsNull())
        .subscribe({
          next: (result) => {
            expect(result).toBeNull();
            done();
          },
          error: (err: unknown) => {
            fail("Should not throw error for 404");
          },
        });
    });

    it("should re-throw non-404 ErrorResponse", (done) => {
      const error500 = new ErrorResponse({ message: "Server Error" }, 500);

      throwError(() => error500)
        .pipe(handle404AsNull())
        .subscribe({
          next: () => {
            fail("Should not emit value for 500 error");
          },
          error: (err: unknown) => {
            expect(err).toBe(error500);
            done();
          },
        });
    });

    it("should re-throw non-ErrorResponse errors", (done) => {
      const genericError = new Error("Generic error");

      throwError(() => genericError)
        .pipe(handle404AsNull())
        .subscribe({
          next: () => {
            fail("Should not emit value for generic error");
          },
          error: (err: unknown) => {
            expect(err).toBe(genericError);
            done();
          },
        });
    });

    it("should pass through successful values", (done) => {
      const testValue = { data: "test" };

      of(testValue)
        .pipe(handle404AsNull())
        .subscribe({
          next: (result) => {
            expect(result).toBe(testValue);
            done();
          },
          error: (err: unknown) => {
            fail("Should not throw error for successful value");
          },
        });
    });
  });

  describe("timeoutWithContext", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should throw custom error message on timeout", (done) => {
      const customMessage = "Custom timeout message";

      // Create an observable that delays longer than the timeout
      of("test")
        .pipe(
          delay(2000), // Delay 2 seconds
          timeoutWithContext(1000, customMessage), // Timeout after 1 second
        )
        .subscribe({
          next: () => {
            done.fail("Should not emit value - should have timed out");
          },
          error: (err: unknown) => {
            expect((err as Error).message).toBe(customMessage);
            done();
          },
        });

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(1001);
    });
  });

  describe("enrichError", () => {
    const context = "Failed to process request";

    it("should enrich TimeoutError with context", (done) => {
      throwError(() => new TimeoutError())
        .pipe(enrichError(context))
        .subscribe({
          next: () => {
            fail("Should not emit value");
          },
          error: (err: unknown) => {
            expect((err as Error).message).toBe(`${context}: Request timed out`);
            done();
          },
        });
    });

    it("should enrich ErrorResponse with status code", (done) => {
      const apiError = new ErrorResponse({ message: "Server Error" }, 500);

      throwError(() => apiError)
        .pipe(enrichError(context))
        .subscribe({
          next: () => {
            fail("Should not emit value");
          },
          error: (err: unknown) => {
            expect((err as Error).message).toBe(`${context}: Server Error (Status: 500)`);
            done();
          },
        });
    });

    it("should enrich generic Error", (done) => {
      const genericError = new Error("Something went wrong");

      throwError(() => genericError)
        .pipe(enrichError(context))
        .subscribe({
          next: () => {
            fail("Should not emit value");
          },
          error: (err: unknown) => {
            expect((err as Error).message).toBe(`${context}: Something went wrong`);
            done();
          },
        });
    });

    it("should handle unknown error types", (done) => {
      const unknownError = "string error";

      throwError(() => unknownError)
        .pipe(enrichError(context))
        .subscribe({
          next: () => {
            fail("Should not emit value");
          },
          error: (err: unknown) => {
            expect((err as Error).message).toBe(`${context}: Unknown error`);
            done();
          },
        });
    });
  });

  describe("timeoutAndEnrichError", () => {
    const timeoutMessage = "Request timeout: Operation took too long";
    const errorContext = "Failed to save data";

    it("should use custom timeout message for TimeoutError", (done) => {
      throwError(() => new TimeoutError())
        .pipe(timeoutAndEnrichError(1000, timeoutMessage, errorContext))
        .subscribe({
          next: () => {
            fail("Should not emit value");
          },
          error: (err: unknown) => {
            expect((err as Error).message).toBe(timeoutMessage);
            done();
          },
        });
    });

    it("should enrich ErrorResponse with context", (done) => {
      const apiError = new ErrorResponse({ message: "Bad Request" }, 400);

      throwError(() => apiError)
        .pipe(timeoutAndEnrichError(1000, timeoutMessage, errorContext))
        .subscribe({
          next: () => {
            fail("Should not emit value");
          },
          error: (err: unknown) => {
            expect((err as Error).message).toBe(`${errorContext}: Bad Request (Status: 400)`);
            done();
          },
        });
    });

    it("should enrich generic errors with context", (done) => {
      const genericError = new Error("Network error");

      throwError(() => genericError)
        .pipe(timeoutAndEnrichError(1000, timeoutMessage, errorContext))
        .subscribe({
          next: () => {
            fail("Should not emit value");
          },
          error: (err: unknown) => {
            expect((err as Error).message).toBe(`${errorContext}: Network error`);
            done();
          },
        });
    });
  });
});
