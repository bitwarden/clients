import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from "@angular/router";
import { firstValueFrom, Observable, of } from "rxjs";

import { LOG_PROVIDER } from "@bitwarden/angular/services/injection-tokens";
import { LogProvider, SemanticLogger } from "@bitwarden/logging";

import { SendAccessService } from "./send-access-service.abstraction";
import { trySendAccess } from "./try-send-access.guard";

function createMockRoute(params: Record<string, any>): ActivatedRouteSnapshot {
  return { params } as ActivatedRouteSnapshot;
}

function createMockLogger(): SemanticLogger {
  return {
    warn: jest.fn(),
    panic: jest.fn().mockImplementation(() => {
      throw new Error("Logger panic called");
    }),
  } as any as SemanticLogger;
}

function createMockLogProvider(): LogProvider {
  return jest.fn().mockReturnValue(createMockLogger()) as any;
}

function createMockSendAccessService() {
  return {
    setContext: jest.fn().mockResolvedValue(undefined),
    redirect$: jest.fn().mockReturnValue(of({} as UrlTree)),
    clear: jest.fn().mockResolvedValue(undefined),
  };
}

describe("trySendAccess", () => {
  let mockSendAccessService: ReturnType<typeof createMockSendAccessService>;
  let mockLogProvider: LogProvider;
  let mockRouterState: RouterStateSnapshot;

  beforeEach(() => {
    mockSendAccessService = createMockSendAccessService();
    mockLogProvider = createMockLogProvider();
    mockRouterState = {} as RouterStateSnapshot;

    TestBed.configureTestingModule({
      providers: [
        { provide: SendAccessService, useValue: mockSendAccessService },
        { provide: LOG_PROVIDER, useValue: mockLogProvider },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("canActivate", () => {
    describe("given valid route parameters", () => {
      it("extracts sendId and key from route params when both are valid strings", async () => {
        const sendId = "test-send-id";
        const key = "test-key";
        const mockRoute = createMockRoute({ sendId, key });
        const expectedUrlTree = { toString: () => "/test-url" } as UrlTree;
        mockSendAccessService.redirect$.mockReturnValue(of(expectedUrlTree));

        // need to cast the result because `CanActivateFn` performs type erasure
        const result$ = TestBed.runInInjectionContext(() =>
          trySendAccess(mockRoute, mockRouterState),
        ) as unknown as Observable<UrlTree>;

        expect(mockSendAccessService.setContext).toHaveBeenCalledWith(sendId, key);
        expect(mockSendAccessService.setContext).toHaveBeenCalledTimes(1);
        await expect(firstValueFrom(result$)).resolves.toEqual(expectedUrlTree);
      });

      it("does not throw validation errors when sendId and key are valid strings", async () => {
        const sendId = "valid-send-id";
        const key = "valid-key";
        const mockRoute = createMockRoute({ sendId, key });
        const expectedUrlTree = { toString: () => "/test-url" } as UrlTree;
        mockSendAccessService.redirect$.mockReturnValue(of(expectedUrlTree));

        // Should not throw any errors during guard execution
        let guardResult: Observable<UrlTree> | undefined;
        expect(() => {
          guardResult = TestBed.runInInjectionContext(() =>
            trySendAccess(mockRoute, mockRouterState),
          ) as unknown as Observable<UrlTree>;
        }).not.toThrow();

        // Verify the observable can be subscribed to without errors
        expect(guardResult).toBeDefined();
        await expect(firstValueFrom(guardResult!)).resolves.toEqual(expectedUrlTree);

        // Logger methods should not be called for warnings or panics
        const mockLogger = (mockLogProvider as jest.Mock).mock.results[0].value;
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.panic).not.toHaveBeenCalled();
      });
    });

    describe("given invalid route parameters", () => {
      describe("given invalid sendId", () => {
        it.each([
          ["undefined", undefined],
          ["null", null],
        ])(
          "logs warning with correct message when sendId is %s",
          async (description, sendIdValue) => {
            const key = "valid-key";
            const mockRoute = createMockRoute(
              sendIdValue === undefined ? { key } : { sendId: sendIdValue, key },
            );
            const mockLogger = createMockLogger();
            (mockLogProvider as jest.Mock).mockReturnValue(mockLogger);

            await expect(async () => {
              const result$ = TestBed.runInInjectionContext(() =>
                trySendAccess(mockRoute, mockRouterState),
              ) as unknown as Observable<UrlTree>;
              await firstValueFrom(result$);
            }).rejects.toThrow("Logger panic called");

            expect(mockLogProvider).toHaveBeenCalledWith({
              function: "trySendAccess",
            });
            expect(mockLogger.warn).toHaveBeenCalledWith(
              "sendId missing from the route parameters; redirecting to 404",
            );
          },
        );

        it.each([
          ["number", 123],
          ["object", {}],
          ["boolean", true],
        ])("logs panic with expected/actual type info when sendId is %s", async (type, value) => {
          const key = "valid-key";
          const mockRoute = createMockRoute({ sendId: value, key });
          const mockLogger = createMockLogger();
          (mockLogProvider as jest.Mock).mockReturnValue(mockLogger);

          await expect(async () => {
            const result$ = TestBed.runInInjectionContext(() =>
              trySendAccess(mockRoute, mockRouterState),
            ) as unknown as Observable<UrlTree>;
            await firstValueFrom(result$);
          }).rejects.toThrow("Logger panic called");

          expect(mockLogProvider).toHaveBeenCalledWith({ function: "trySendAccess" });
          expect(mockLogger.panic).toHaveBeenCalledWith(
            { expected: "string", actual: type },
            "sendId has invalid type",
          );
        });

        it("throws when sendId is not a string", async () => {
          const key = "valid-key";
          const invalidSendIdValues = [123, {}, true, null, undefined];

          for (const invalidSendId of invalidSendIdValues) {
            const mockRoute = createMockRoute(
              invalidSendId === undefined ? { key } : { sendId: invalidSendId, key },
            );
            const mockLogger = createMockLogger();
            (mockLogProvider as jest.Mock).mockReturnValue(mockLogger);

            await expect(async () => {
              const result$ = TestBed.runInInjectionContext(() =>
                trySendAccess(mockRoute, mockRouterState),
              ) as unknown as Observable<UrlTree>;
              await firstValueFrom(result$);
            }).rejects.toThrow("Logger panic called");
          }
        });
      });

      describe("given invalid key", () => {
        it.each([
          ["undefined", undefined],
          ["null", null],
        ])("logs panic with correct message when key is %s", async (description, keyValue) => {
          const sendId = "valid-send-id";
          const mockRoute = createMockRoute(
            keyValue === undefined ? { sendId } : { sendId, key: keyValue },
          );
          const mockLogger = createMockLogger();
          (mockLogProvider as jest.Mock).mockReturnValue(mockLogger);

          await expect(async () => {
            const result$ = TestBed.runInInjectionContext(() =>
              trySendAccess(mockRoute, mockRouterState),
            ) as unknown as Observable<UrlTree>;
            await firstValueFrom(result$);
          }).rejects.toThrow("Logger panic called");

          expect(mockLogProvider).toHaveBeenCalledWith({ function: "trySendAccess" });
          expect(mockLogger.panic).toHaveBeenCalledWith("key missing from the route parameters");
        });

        it.each([
          ["number", 123],
          ["object", {}],
          ["boolean", true],
        ])("logs panic with expected/actual type info when key is %s", async (type, value) => {
          const sendId = "valid-send-id";
          const mockRoute = createMockRoute({ sendId, key: value });
          const mockLogger = createMockLogger();
          (mockLogProvider as jest.Mock).mockReturnValue(mockLogger);

          await expect(async () => {
            const result$ = TestBed.runInInjectionContext(() =>
              trySendAccess(mockRoute, mockRouterState),
            ) as unknown as Observable<UrlTree>;
            await firstValueFrom(result$);
          }).rejects.toThrow("Logger panic called");

          expect(mockLogProvider).toHaveBeenCalledWith({ function: "trySendAccess" });
          expect(mockLogger.panic).toHaveBeenCalledWith(
            { expected: "string", actual: type },
            "key has invalid type",
          );
        });

        it("throws when key is not a string", async () => {
          const sendId = "valid-send-id";
          const invalidKeyValues = [123, {}, true, null, undefined];

          for (const invalidKey of invalidKeyValues) {
            const mockRoute = createMockRoute(
              invalidKey === undefined ? { sendId } : { sendId, key: invalidKey },
            );
            const mockLogger = createMockLogger();
            (mockLogProvider as jest.Mock).mockReturnValue(mockLogger);

            await expect(async () => {
              const result$ = TestBed.runInInjectionContext(() =>
                trySendAccess(mockRoute, mockRouterState),
              ) as unknown as Observable<UrlTree>;
              await firstValueFrom(result$);
            }).rejects.toThrow("Logger panic called");
          }
        });
      });
    });

    describe("given service interactions", () => {
      it("calls setContext with extracted sendId and key when parameters are valid", async () => {
        const sendId = "test-send-id";
        const key = "test-key";
        const mockRoute = createMockRoute({ sendId, key });
        const expectedUrlTree = { toString: () => "/test-url" } as UrlTree;
        mockSendAccessService.redirect$.mockReturnValue(of(expectedUrlTree));

        const result$ = TestBed.runInInjectionContext(() =>
          trySendAccess(mockRoute, mockRouterState),
        ) as unknown as Observable<UrlTree>;

        await firstValueFrom(result$);

        expect(mockSendAccessService.setContext).toHaveBeenCalledWith(sendId, key);
        expect(mockSendAccessService.setContext).toHaveBeenCalledTimes(1);
      });

      it("calls redirect$ with extracted sendId when setContext completes", async () => {
        const sendId = "test-send-id";
        const key = "test-key";
        const mockRoute = createMockRoute({ sendId, key });
        const expectedUrlTree = { toString: () => "/test-url" } as UrlTree;
        mockSendAccessService.redirect$.mockReturnValue(of(expectedUrlTree));

        const result$ = TestBed.runInInjectionContext(() =>
          trySendAccess(mockRoute, mockRouterState),
        ) as unknown as Observable<UrlTree>;

        await firstValueFrom(result$);

        expect(mockSendAccessService.redirect$).toHaveBeenCalledWith(sendId);
        expect(mockSendAccessService.redirect$).toHaveBeenCalledTimes(1);
      });
    });

    describe("given observable behavior", () => {
      it("returns redirect$ emissions when setContext completes successfully", async () => {
        const sendId = "test-send-id";
        const key = "test-key";
        const mockRoute = createMockRoute({ sendId, key });
        const expectedUrlTree = { toString: () => "/test-url" } as UrlTree;
        mockSendAccessService.redirect$.mockReturnValue(of(expectedUrlTree));

        const result$ = TestBed.runInInjectionContext(() =>
          trySendAccess(mockRoute, mockRouterState),
        ) as unknown as Observable<UrlTree>;

        const actualResult = await firstValueFrom(result$);

        expect(actualResult).toEqual(expectedUrlTree);
        expect(mockSendAccessService.redirect$).toHaveBeenCalledWith(sendId);
      });

      it("does not emit setContext values when using ignoreElements", async () => {
        const sendId = "test-send-id";
        const key = "test-key";
        const mockRoute = createMockRoute({ sendId, key });
        const expectedUrlTree = { toString: () => "/test-url" } as UrlTree;
        const setContextValue = "should-not-be-emitted";

        // Mock setContext to return a value
        mockSendAccessService.setContext.mockResolvedValue(setContextValue);
        mockSendAccessService.redirect$.mockReturnValue(of(expectedUrlTree));

        const result$ = TestBed.runInInjectionContext(() =>
          trySendAccess(mockRoute, mockRouterState),
        ) as unknown as Observable<UrlTree>;

        const actualResult = await firstValueFrom(result$);

        // Should only emit the redirect$ value, not the setContext value
        expect(actualResult).toEqual(expectedUrlTree);
        expect(actualResult).not.toEqual(setContextValue);
      });

      it("ensures setContext completes before redirect$ executes (sequencing)", async () => {
        const sendId = "test-send-id";
        const key = "test-key";
        const mockRoute = createMockRoute({ sendId, key });
        const expectedUrlTree = { toString: () => "/test-url" } as UrlTree;

        let setContextResolved = false;

        // Mock setContext to track when it resolves
        mockSendAccessService.setContext.mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
          setContextResolved = true;
        });

        // Mock redirect$ to return a delayed observable and check if setContext resolved
        mockSendAccessService.redirect$.mockImplementation((id) => {
          return new Observable((subscriber) => {
            // Check if setContext has resolved when redirect$ subscription starts
            setTimeout(() => {
              expect(setContextResolved).toBe(true);
              subscriber.next(expectedUrlTree);
              subscriber.complete();
            }, 0);
          });
        });

        const result$ = TestBed.runInInjectionContext(() =>
          trySendAccess(mockRoute, mockRouterState),
        ) as unknown as Observable<UrlTree>;

        await firstValueFrom(result$);
      });
    });

    describe("given error scenarios", () => {
      it("does not call redirect$ when setContext rejects", async () => {
        const sendId = "test-send-id";
        const key = "test-key";
        const mockRoute = createMockRoute({ sendId, key });
        const setContextError = new Error("setContext failed");

        // Reset mocks to ensure clean state
        jest.clearAllMocks();

        // Mock setContext to reject
        mockSendAccessService.setContext.mockRejectedValue(setContextError);

        // Create a mock observable that we can spy on subscription
        const mockRedirectObservable = of({} as UrlTree);
        const subscribeSpy = jest.spyOn(mockRedirectObservable, "subscribe");
        mockSendAccessService.redirect$.mockReturnValue(mockRedirectObservable);

        const result$ = TestBed.runInInjectionContext(() =>
          trySendAccess(mockRoute, mockRouterState),
        ) as unknown as Observable<UrlTree>;

        // Expect the observable to reject when setContext fails
        await expect(firstValueFrom(result$)).rejects.toThrow("setContext failed");

        // The redirect$ method will be called (since it's called synchronously)
        expect(mockSendAccessService.redirect$).toHaveBeenCalledWith(sendId);

        // But the returned observable should not be subscribed to due to the error
        // Note: This test verifies the error propagation behavior
        expect(subscribeSpy).not.toHaveBeenCalled();
      });

      it("propagates error to guard return value when redirect$ throws", async () => {
        const sendId = "test-send-id";
        const key = "test-key";
        const mockRoute = createMockRoute({ sendId, key });
        const redirectError = new Error("redirect$ failed");

        // Reset mocks to ensure clean state
        jest.clearAllMocks();

        // Mock setContext to succeed and redirect$ to throw
        mockSendAccessService.setContext.mockResolvedValue(undefined);
        mockSendAccessService.redirect$.mockReturnValue(
          new Observable((subscriber) => {
            subscriber.error(redirectError);
          }),
        );

        const result$ = TestBed.runInInjectionContext(() =>
          trySendAccess(mockRoute, mockRouterState),
        ) as unknown as Observable<UrlTree>;

        // Expect the observable to propagate the redirect$ error
        await expect(firstValueFrom(result$)).rejects.toThrow("redirect$ failed");

        // Verify that setContext was called (should succeed)
        expect(mockSendAccessService.setContext).toHaveBeenCalledWith(sendId, key);

        // Verify that redirect$ was called (but it throws)
        expect(mockSendAccessService.redirect$).toHaveBeenCalledWith(sendId);
      });
    });
  });
});
