import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PasskeyRelayService, PasskeyLoginRelayResult } from "./passkey-relay.service";

describe("PasskeyRelayService", () => {
  let service: PasskeyRelayService;
  let logService: LogService;
  let storageChangeListener: (changes: any, areaName: string) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    (chrome.storage as any).session = {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    };
    (chrome.storage as any).onChanged = {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    };

    logService = mock<LogService>();
    service = new PasskeyRelayService(logService);
    storageChangeListener = (chrome.storage.onChanged.addListener as jest.Mock).mock.calls[0][0];

    // Clear construction-time calls but keep the captured listener
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("registers a chrome storage change listener on construction", () => {
    expect(storageChangeListener).toBeDefined();
  });

  describe("storeResult", () => {
    it("stores a login result with a serialized prfOutput", async () => {
      const prfOutput = new Uint8Array([1, 2, 3]).buffer;
      const result: PasskeyLoginRelayResult = {
        type: "login",
        token: "token",
        assertionData: "assertion",
        prfOutput,
      };

      await service.storeResult(result);

      expect(chrome.storage.session.set).toHaveBeenCalledWith({
        passkeyRelayResult: expect.objectContaining({
          type: "login",
          token: "token",
          assertionData: "assertion",
          prfOutput: [1, 2, 3],
          timestamp: expect.any(Number),
        }),
      });
    });

    it("stores a result with a null prfOutput", async () => {
      const result: PasskeyLoginRelayResult = {
        type: "login",
        token: "token",
        assertionData: "assertion",
        prfOutput: null,
      };

      await service.storeResult(result);

      expect(chrome.storage.session.set).toHaveBeenCalledWith({
        passkeyRelayResult: expect.objectContaining({
          prfOutput: null,
        }),
      });
    });
  });

  describe("consumeResult", () => {
    it("returns the stored login result and clears it from storage", async () => {
      const prfOutput = new Uint8Array([4, 5, 6]).buffer;
      const stored = {
        type: "login",
        token: "token",
        assertionData: "assertion",
        prfOutput: Array.from(new Uint8Array(prfOutput)),
        timestamp: Date.now(),
      };
      (chrome.storage.session.get as jest.Mock).mockResolvedValueOnce({
        passkeyRelayResult: stored,
      });

      const result = await service.consumeResult();

      expect(result).toEqual({
        type: "login",
        token: "token",
        assertionData: "assertion",
        prfOutput,
      });
      expect(chrome.storage.session.remove).toHaveBeenCalledWith("passkeyRelayResult");
    });

    it("returns the stored unlock result and clears it from storage", async () => {
      const prfOutput = new Uint8Array([7, 8, 9]).buffer;
      const stored = {
        type: "unlock",
        credentialId: "credential-id",
        prfOutput: Array.from(new Uint8Array(prfOutput)),
        timestamp: Date.now(),
      };
      (chrome.storage.session.get as jest.Mock).mockResolvedValueOnce({
        passkeyRelayResult: stored,
      });

      const result = await service.consumeResult();

      expect(result).toEqual({
        type: "unlock",
        credentialId: "credential-id",
        prfOutput,
      });
      expect(chrome.storage.session.remove).toHaveBeenCalledWith("passkeyRelayResult");
    });

    it("waits for a storage change when no result is present initially", async () => {
      const prfOutput = new Uint8Array([1, 2, 3]).buffer;
      const stored = {
        type: "login",
        token: "token",
        assertionData: "assertion",
        prfOutput: Array.from(new Uint8Array(prfOutput)),
        timestamp: Date.now(),
      };
      (chrome.storage.session.get as jest.Mock)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ passkeyRelayResult: stored });

      const listener = storageChangeListener;
      const consumePromise = service.consumeResult();

      // Allow the service to start waiting for the storage change event
      await Promise.resolve();

      listener({ passkeyRelayResult: { newValue: stored } }, "session");

      const result = await consumePromise;

      expect(result).toEqual({
        type: "login",
        token: "token",
        assertionData: "assertion",
        prfOutput,
      });
    });

    it("returns null when the storage change does not contain the relay key", async () => {
      (chrome.storage.session.get as jest.Mock).mockResolvedValueOnce({});
      jest.useFakeTimers();

      const consumePromise = service.consumeResult();

      await Promise.resolve();

      storageChangeListener({ someOtherKey: { newValue: "value" } }, "session");

      await jest.advanceTimersByTimeAsync(5000);

      const result = await consumePromise;

      expect(result).toBeNull();
      expect(logService.error).toHaveBeenCalledWith("[PasskeyRelay] Timeout waiting for result");
    });

    it("returns null when the wait for a storage change times out", async () => {
      (chrome.storage.session.get as jest.Mock).mockResolvedValueOnce({});
      jest.useFakeTimers();

      const consumePromise = service.consumeResult();

      await jest.advanceTimersByTimeAsync(5000);

      const result = await consumePromise;

      expect(result).toBeNull();
      expect(logService.error).toHaveBeenCalledWith("[PasskeyRelay] Timeout waiting for result");
    });

    it("returns null when there is no stored result after the change event", async () => {
      (chrome.storage.session.get as jest.Mock).mockResolvedValueOnce({}).mockResolvedValueOnce({});

      const consumePromise = service.consumeResult();

      await Promise.resolve();

      // A change event for the relay key resolves the wait even if storage is then empty
      storageChangeListener({ passkeyRelayResult: { newValue: {} } }, "session");

      const result = await consumePromise;

      expect(result).toBeNull();
      expect(logService.error).toHaveBeenCalledWith("[PasskeyRelay] No result found in storage");
    });
  });

  describe("hasPendingResult", () => {
    it("returns false when no result is stored", async () => {
      (chrome.storage.session.get as jest.Mock).mockResolvedValueOnce({});

      const result = await service.hasPendingResult();

      expect(result).toBe(false);
    });

    it("returns true when a recently stored result exists", async () => {
      (chrome.storage.session.get as jest.Mock).mockResolvedValueOnce({
        passkeyRelayResult: { timestamp: Date.now() },
      });

      const result = await service.hasPendingResult();

      expect(result).toBe(true);
    });

    it("clears an expired result and returns false", async () => {
      (chrome.storage.session.get as jest.Mock).mockResolvedValueOnce({
        passkeyRelayResult: { timestamp: Date.now() - 6 * 60 * 1000 },
      });

      const result = await service.hasPendingResult();

      expect(result).toBe(false);
      expect(chrome.storage.session.remove).toHaveBeenCalledWith("passkeyRelayResult");
    });
  });

  describe("clearResult", () => {
    it("removes the stored result", async () => {
      await service.clearResult();

      expect(chrome.storage.session.remove).toHaveBeenCalledWith("passkeyRelayResult");
    });
  });
});
