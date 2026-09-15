import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { SharedUnlockPeerService } from "@bitwarden/common/key-management/shared-unlock";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UnlockEvent, UnlockMethod, UnlockService } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

import { CliIpcService } from "../platform/services/cli-ipc.service";

import { CliSharedUnlockService } from "./cli-shared-unlock.service";

describe("CliSharedUnlockService", () => {
  let sut: CliSharedUnlockService;

  const configService = mock<ConfigService>();
  const ipcService = mock<CliIpcService>();
  const peerService = mock<SharedUnlockPeerService>();
  const unlockService = mock<UnlockService>();
  const logService = mock<LogService>();

  const userId = "user-id" as UserId;
  let unlocked: Subject<UnlockEvent>;

  beforeEach(() => {
    jest.clearAllMocks();

    unlocked = new Subject<UnlockEvent>();
    unlockService.unlocked$ = unlocked.asObservable();
    configService.getFeatureFlag.mockResolvedValue(true);
    peerService.start.mockResolvedValue(undefined);

    sut = new CliSharedUnlockService(
      configService,
      ipcService,
      peerService,
      unlockService,
      logService,
    );
  });

  describe("start", () => {
    it("starts the peer with an abort controller", async () => {
      await expect(sut.start()).resolves.toBe(true);

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.SharedUnlockPart2);
      expect(peerService.start).toHaveBeenCalledWith(expect.any(AbortController));
    });

    it("does nothing when the feature flag is off", async () => {
      configService.getFeatureFlag.mockResolvedValue(false);

      await expect(sut.start()).resolves.toBe(false);

      expect(peerService.start).not.toHaveBeenCalled();
    });

    it("returns false rather than throwing when the peer cannot start", async () => {
      peerService.start.mockRejectedValue(new Error("no desktop"));

      await expect(sut.start()).resolves.toBe(false);

      expect(logService.info).toHaveBeenCalled();
    });

    it("starts the peer only once", async () => {
      await sut.start();
      await sut.start();

      expect(peerService.start).toHaveBeenCalledTimes(1);
    });
  });

  describe("waitForRemoteUnlock", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("resolves true when a peer unlocks the user", async () => {
      const waiting = sut.waitForRemoteUnlock(userId);
      unlocked.next({ userId, method: UnlockMethod.SharedUnlock });

      await expect(waiting).resolves.toBe(true);
    });

    it("ignores an unlock this device performed itself", async () => {
      const waiting = sut.waitForRemoteUnlock(userId);
      unlocked.next({ userId, method: UnlockMethod.MasterPassword });
      jest.advanceTimersByTime(3_000);

      await expect(waiting).resolves.toBe(false);
    });

    it("ignores an unlock for another user", async () => {
      const waiting = sut.waitForRemoteUnlock(userId);
      unlocked.next({ userId: "other-user" as UserId, method: UnlockMethod.SharedUnlock });
      jest.advanceTimersByTime(3_000);

      await expect(waiting).resolves.toBe(false);
    });

    it("resolves false when the desktop app never answers", async () => {
      const waiting = sut.waitForRemoteUnlock(userId);
      jest.advanceTimersByTime(3_000);

      await expect(waiting).resolves.toBe(false);
    });
  });

  describe("abort", () => {
    it("aborts the signal the peer was started with", async () => {
      await sut.start();
      const [abortController] = peerService.start.mock.calls[0] as [AbortController];

      sut.abort();

      expect(abortController.signal.aborted).toBe(true);
    });

    it("does nothing when no peer was started", () => {
      expect(() => sut.abort()).not.toThrow();
    });
  });

  describe("stop", () => {
    it("aborts and drains the transport", async () => {
      await sut.start();

      await sut.stop();

      expect(ipcService.drainAndDisconnect).toHaveBeenCalled();
    });
  });
});
