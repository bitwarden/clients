import { mock } from "jest-mock-extended";
import { Subject, firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { tagAsExternal } from "@bitwarden/common/platform/messaging/helpers";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { FullSyncMessage } from "./foreground-sync.service";
import { FULL_SYNC_FINISHED, SyncServiceListener } from "./sync-service.listener";

describe("SyncServiceListener", () => {
  const syncService = mock<SyncService>();
  const messageListener = mock<MessageListener>();
  const messageSender = mock<MessageSender>();
  const logService = mock<LogService>();

  const messages = new Subject<FullSyncMessage>();
  messageListener.messages$.mockReturnValue(messages.asObservable().pipe(tagAsExternal()));
  const sut = new SyncServiceListener(syncService, messageListener, messageSender, logService);

  describe("listener$", () => {
    it.each([true, false])(
      "calls full sync and relays outcome when sync is [successfully = %s]",
      async (value) => {
        const listener = sut.listener$();
        const emissionPromise = firstValueFrom(listener);

        syncService.fullSync.mockResolvedValueOnce(value);
        messages.next({ forceSync: true, allowThrowOnError: false, requestId: "1" });

        await emissionPromise;

        expect(syncService.fullSync).toHaveBeenCalledWith(true, false);
        expect(messageSender.send).toHaveBeenCalledWith(FULL_SYNC_FINISHED, {
          successfully: value,
          errorMessage: null,
          requestId: "1",
        });
      },
    );

    it("calls full sync and relays error message through messaging", async () => {
      const listener = sut.listener$();
      const emissionPromise = firstValueFrom(listener);

      syncService.fullSync.mockRejectedValueOnce(new Error("SyncError"));
      messages.next({ forceSync: true, allowThrowOnError: false, requestId: "1" });

      await emissionPromise;

      expect(syncService.fullSync).toHaveBeenCalledWith(true, false);
      expect(messageSender.send).toHaveBeenCalledWith(FULL_SYNC_FINISHED, {
        successfully: false,
        errorMessage: "SyncError",
        requestId: "1",
      });
    });
  });
});
