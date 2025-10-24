import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { Router, UrlTree } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, NEVER } from "rxjs";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { mockAccountServiceWith, FakeStateProvider } from "@bitwarden/common/spec";
import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { SYSTEM_SERVICE_PROVIDER } from "@bitwarden/generator-components";

import { DefaultSendAccessService } from "./default-send-access-service";
import { SEND_RESPONSE_KEY, SEND_CONTEXT_KEY } from "./send-access-memory";

describe("DefaultSendAccessService", () => {
  let service: DefaultSendAccessService;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let stateProvider: FakeStateProvider;
  let sendApiService: MockProxy<SendApiService>;
  let router: MockProxy<Router>;
  let logger: MockProxy<SemanticLogger>;
  let systemServiceProvider: MockProxy<SystemServiceProvider>;

  beforeEach(() => {
    jest.resetAllMocks();

    const accountService = mockAccountServiceWith("user-id" as UserId);
    stateProvider = new FakeStateProvider(accountService);
    sendApiService = mock<SendApiService>();
    router = mock<Router>();
    logger = mock<SemanticLogger>();
    systemServiceProvider = mock<SystemServiceProvider>();
    cryptoFunctionService = mock<CryptoFunctionService>();

    systemServiceProvider.log.mockReturnValue(logger);

    TestBed.configureTestingModule({
      providers: [
        DefaultSendAccessService,
        { provide: CryptoFunctionService, useValue: cryptoFunctionService },
        { provide: StateProvider, useValue: stateProvider },
        { provide: SendApiService, useValue: sendApiService },
        { provide: Router, useValue: router },
        { provide: SYSTEM_SERVICE_PROVIDER, useValue: systemServiceProvider },
      ],
    });

    service = TestBed.inject(DefaultSendAccessService);
  });

  describe("constructor", () => {
    it("creates logger with type 'SendAccessAuthenticationService' when initialized", () => {
      expect(systemServiceProvider.log).toHaveBeenCalledWith({
        type: "SendAccessAuthenticationService",
      });
    });
  });

  describe("redirect$", () => {
    const sendId = "test-send-id";

    it("returns content page UrlTree and logs info when API returns success", async () => {
      const expectedUrlTree = { toString: () => "/send/content/test-send-id" } as UrlTree;
      sendApiService.postSendAccess.mockResolvedValue({} as any);
      router.createUrlTree.mockReturnValue(expectedUrlTree);

      const result = await firstValueFrom(service.redirect$(sendId));

      expect(result).toBe(expectedUrlTree);
      expect(logger.info).toHaveBeenCalledWith(
        "public send detected; redirecting to send access with token.",
      );
    });

    describe("given error responses", () => {
      it("returns password flow UrlTree and logs debug when 401 received", async () => {
        const expectedUrlTree = { toString: () => "/send/test-send-id" } as UrlTree;
        const errorResponse = new ErrorResponse([], 401);
        sendApiService.postSendAccess.mockRejectedValue(errorResponse);
        router.createUrlTree.mockReturnValue(expectedUrlTree);

        const result = await firstValueFrom(service.redirect$(sendId));

        expect(result).toBe(expectedUrlTree);
        expect(logger.debug).toHaveBeenCalledWith(errorResponse, "redirecting to password flow");
      });

      it("returns 404 page UrlTree and logs debug when 404 received", async () => {
        const expectedUrlTree = { toString: () => "/404.html" } as UrlTree;
        const errorResponse = new ErrorResponse([], 404);
        sendApiService.postSendAccess.mockRejectedValue(errorResponse);
        router.parseUrl.mockReturnValue(expectedUrlTree);

        const result = await firstValueFrom(service.redirect$(sendId));

        expect(result).toBe(expectedUrlTree);
        expect(logger.debug).toHaveBeenCalledWith(errorResponse, "redirecting to unavailable page");
      });

      it("logs warning and throws error when 500 received", async () => {
        const errorResponse = new ErrorResponse([], 500);
        sendApiService.postSendAccess.mockRejectedValue(errorResponse);

        await expect(firstValueFrom(service.redirect$(sendId))).rejects.toBe(errorResponse);
        expect(logger.warn).toHaveBeenCalledWith(
          errorResponse,
          "received unexpected error response",
        );
      });

      it("throws error when unexpected error code received", async () => {
        const errorResponse = new ErrorResponse([], 403);
        sendApiService.postSendAccess.mockRejectedValue(errorResponse);

        await expect(firstValueFrom(service.redirect$(sendId))).rejects.toBe(errorResponse);
        expect(logger.warn).toHaveBeenCalledWith(
          errorResponse,
          "received unexpected error response",
        );
      });
    });

    it("throws error when non-ErrorResponse error occurs", async () => {
      const regularError = new Error("Network error");
      sendApiService.postSendAccess.mockRejectedValue(regularError);

      await expect(firstValueFrom(service.redirect$(sendId))).rejects.toThrow("Network error");
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("emits timeout error when API response exceeds 10 seconds", fakeAsync(() => {
      // simulate a hung request
      sendApiService.postSendAccess.mockReturnValue(firstValueFrom(NEVER));

      const result$ = service.redirect$(sendId);
      let error: any;

      result$.subscribe({
        error: (err: unknown) => (error = err),
      });

      // Advance time past 10 seconds
      tick(10001);

      expect(error).toBeDefined();
      expect(error.name).toBe("TimeoutError");
    }));
  });

  describe("setContext", () => {
    it("updates global state with send context when called with sendId and key", async () => {
      const sendId = "test-send-id";
      const key = "test-key";

      await service.setContext(sendId, key);

      const context = await firstValueFrom(stateProvider.getGlobal(SEND_CONTEXT_KEY).state$);
      expect(context).toEqual({ id: sendId, key });
    });
  });

  describe("clear", () => {
    it("sets both SEND_RESPONSE_KEY and SEND_CONTEXT_KEY to null when called", async () => {
      await stateProvider.getGlobal(SEND_RESPONSE_KEY).update(() => ({ some: "response" }) as any);
      await stateProvider.getGlobal(SEND_CONTEXT_KEY).update(() => ({ id: "test", key: "test" }));

      await service.clear();

      const response = await firstValueFrom(stateProvider.getGlobal(SEND_RESPONSE_KEY).state$);
      const context = await firstValueFrom(stateProvider.getGlobal(SEND_CONTEXT_KEY).state$);

      expect(response).toBeNull();
      expect(context).toBeNull();
    });
  });

  describe("authenticate$", () => {
    const sendId = "test-send-id";
    const password = "test-password";

    it("returns true and stores response when authentication succeeds", async () => {
      const keyArray = new Uint8Array([1, 2, 3, 4, 5]);
      const key = Utils.fromBufferToB64(keyArray);
      const hashedArray = new Uint8Array([10, 20, 30, 40]);
      const expectedPassword = Utils.fromBufferToB64(hashedArray);
      const mockResponse = { id: sendId, data: "some data" } as any;

      await stateProvider.getGlobal(SEND_CONTEXT_KEY).update(() => ({ id: sendId, key }));
      cryptoFunctionService.pbkdf2.mockResolvedValue(hashedArray);
      sendApiService.postSendAccess.mockResolvedValue(mockResponse);

      const result = await firstValueFrom(service.authenticate$(sendId, password));

      expect(result).toBe(true);
      expect(sendApiService.postSendAccess).toHaveBeenCalledWith(
        sendId,
        expect.objectContaining({ password: expectedPassword }),
      );

      // Verify response is stored in state
      const storedResponse = await firstValueFrom(
        stateProvider.getGlobal(SEND_RESPONSE_KEY).state$,
      );
      expect(storedResponse).toBe(mockResponse);
    });

    it("returns false and logs debug when authentication fails with 401", async () => {
      const keyArray = new Uint8Array([1, 2, 3, 4, 5]);
      const key = Utils.fromBufferToB64(keyArray);
      const hashedArray = new Uint8Array([10, 20, 30, 40]);
      const errorResponse = new ErrorResponse([], 401);
      await stateProvider.getGlobal(SEND_CONTEXT_KEY).update(() => ({ id: sendId, key }));
      cryptoFunctionService.pbkdf2.mockResolvedValue(hashedArray);
      sendApiService.postSendAccess.mockRejectedValue(errorResponse);

      const result = await firstValueFrom(service.authenticate$(sendId, password));

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith("received failed authentication response");

      // Verify state is not updated
      const storedResponse = await firstValueFrom(
        stateProvider.getGlobal(SEND_RESPONSE_KEY).state$,
      );
      expect(storedResponse).toBeNull();
    });

    it("panics when sendId mismatch occurs", fakeAsync(async () => {
      const wrongSendId = "wrong-send-id";
      const keyArray = new Uint8Array([1, 2, 3, 4, 5]);
      const key = Utils.fromBufferToB64(keyArray);
      await stateProvider.getGlobal(SEND_CONTEXT_KEY).update(() => ({ id: wrongSendId, key }));
      logger.panicWhen.mockImplementation((condition, data, message) => {
        if (condition) {
          throw new Error(`Panic: ${message}`);
        }

        return true;
      });

      const result$ = service.authenticate$(sendId, password);
      let error: any;
      result$.subscribe({
        error: (err: unknown) => (error = err),
      });

      tick();

      expect(error).toBeDefined();
      expect(error.message).toBe("Panic: unexpected sendId");
      expect(logger.panicWhen).toHaveBeenCalledWith(
        true, // condition: sendId !== id (test-send-id !== wrong-send-id)
        { expected: sendId, actual: sendId },
        "unexpected sendId",
      );
    }));

    it("emits timeout error when context is null", fakeAsync(async () => {
      await stateProvider.getGlobal(SEND_CONTEXT_KEY).update(() => null);

      const result$ = service.authenticate$(sendId, password);
      let error: any;

      result$.subscribe({
        error: (err: unknown) => (error = err),
      });

      // Advance time past 10 seconds
      tick(10001);

      expect(error).toBeDefined();
      expect(error.name).toBe("TimeoutError");
    }));

    it("emits timeout error when context is invalid", fakeAsync(async () => {
      await stateProvider.getGlobal(SEND_CONTEXT_KEY).update(() => ({ missingId: "test" }) as any);

      const result$ = service.authenticate$(sendId, password);
      let error: any;

      result$.subscribe({
        error: (err: unknown) => (error = err),
      });

      // Advance time past 10 seconds
      tick(10001);

      expect(error).toBeDefined();
      expect(error.name).toBe("TimeoutError");
    }));

    it("throws error and logs when server error occurs", async () => {
      const keyArray = new Uint8Array([1, 2, 3, 4, 5]);
      const key = Utils.fromBufferToB64(keyArray);
      const hashedArray = new Uint8Array([10, 20, 30, 40]);
      const errorResponse = new ErrorResponse([], 500);
      await stateProvider.getGlobal(SEND_CONTEXT_KEY).update(() => ({ id: sendId, key }));

      cryptoFunctionService.pbkdf2.mockResolvedValue(hashedArray);
      sendApiService.postSendAccess.mockRejectedValue(errorResponse);

      await expect(firstValueFrom(service.authenticate$(sendId, password))).rejects.toBe(
        errorResponse,
      );

      expect(logger.error).toHaveBeenCalledWith("an error occurred during authentication");
    });

    it("throws error and logs when network error occurs", async () => {
      const keyArray = new Uint8Array([1, 2, 3, 4, 5]);
      const key = Utils.fromBufferToB64(keyArray);
      const hashedArray = new Uint8Array([10, 20, 30, 40]);
      const networkError = new Error("Network error");
      await stateProvider.getGlobal(SEND_CONTEXT_KEY).update(() => ({ id: sendId, key }));
      cryptoFunctionService.pbkdf2.mockResolvedValue(hashedArray);
      sendApiService.postSendAccess.mockRejectedValue(networkError);

      await expect(firstValueFrom(service.authenticate$(sendId, password))).rejects.toThrow(
        "Network error",
      );

      expect(logger.error).toHaveBeenCalledWith("an error occurred during authentication");
    });

    it("emits timeout error when API response exceeds 10 seconds", fakeAsync(async () => {
      const keyArray = new Uint8Array([1, 2, 3, 4, 5]);
      const key = Utils.fromBufferToB64(keyArray);
      const hashedArray = new Uint8Array([10, 20, 30, 40]);
      await stateProvider.getGlobal(SEND_CONTEXT_KEY).update(() => ({ id: sendId, key }));

      // simulate a hung request
      sendApiService.postSendAccess.mockReturnValue(firstValueFrom(NEVER));
      cryptoFunctionService.pbkdf2.mockResolvedValue(hashedArray);

      const result$ = service.authenticate$(sendId, password);
      let error: any;

      result$.subscribe({
        error: (err: unknown) => (error = err),
      });

      // Advance time past 10 seconds
      tick(10001);

      expect(error).toBeDefined();
      expect(error.name).toBe("TimeoutError");
    }));
  });
});
