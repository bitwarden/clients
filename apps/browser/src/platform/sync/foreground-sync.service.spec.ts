import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncOptions } from "@bitwarden/common/platform/sync/sync.service";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { InternalSendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { InternalFolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";

import { DO_FULL_SYNC, ForegroundSyncService, FullSyncMessage } from "./foreground-sync.service";
import { FullSyncFinishedMessage } from "./sync-service.listener";

describe("ForegroundSyncService", () => {
  const userId = Utils.newGuid() as UserId;
  const tokenService = mock<TokenService>();
  const folderService = mock<InternalFolderService>();
  const folderApiService = mock<FolderApiServiceAbstraction>();
  const messageSender = mock<MessageSender>();
  const logService = mock<LogService>();
  const cipherService = mock<CipherService>();
  const collectionService = mock<CollectionService>();
  const apiService = mock<ApiService>();
  const accountService = mockAccountServiceWith(userId);
  const authService = mock<AuthService>();
  const sendService = mock<InternalSendService>();
  const sendApiService = mock<SendApiService>();
  const messageListener = mock<MessageListener>();
  const stateProvider = new FakeStateProvider(accountService);

  const sut = new ForegroundSyncService(
    tokenService,
    folderService,
    folderApiService,
    messageSender,
    logService,
    cipherService,
    collectionService,
    apiService,
    accountService,
    authService,
    sendService,
    sendApiService,
    messageListener,
    stateProvider,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("fullSync", () => {
    const getAndAssertRequestId = (doFullSyncMessage: Omit<FullSyncMessage, "requestId">) => {
      expect(messageSender.send).toHaveBeenCalledWith(
        DO_FULL_SYNC,
        // We don't know the request id since that is created internally
        expect.objectContaining(doFullSyncMessage),
      );

      const message = messageSender.send.mock.calls[0][1];

      if (!("requestId" in message) || typeof message.requestId !== "string") {
        throw new Error("requestId property of type string was expected on the sent message.");
      }

      return message.requestId;
    };

    it("correctly relays a successful fullSync", async () => {
      const messages = new Subject<FullSyncFinishedMessage>();
      messageListener.messages$.mockReturnValue(messages);
      const fullSyncPromise = sut.fullSync(true, false);
      expect(sut.syncInProgress).toBe(true);

      const requestId = getAndAssertRequestId({
        forceSync: true,
        options: { allowThrowOnError: false, skipTokenRefresh: false },
      });

      // Pretend the sync has finished
      messages.next({ successfully: true, errorMessage: null, requestId: requestId });

      const result = await fullSyncPromise;

      expect(sut.syncInProgress).toBe(false);
      expect(result).toBe(true);
    });

    const testData: {
      input: boolean | SyncOptions | undefined;
      normalized: Required<SyncOptions>;
    }[] = [
      {
        input: undefined,
        normalized: { allowThrowOnError: false, skipTokenRefresh: false },
      },
      {
        input: true,
        normalized: { allowThrowOnError: true, skipTokenRefresh: false },
      },
      {
        input: false,
        normalized: { allowThrowOnError: false, skipTokenRefresh: false },
      },
      {
        input: { allowThrowOnError: false },
        normalized: { allowThrowOnError: false, skipTokenRefresh: false },
      },
      {
        input: { allowThrowOnError: true },
        normalized: { allowThrowOnError: true, skipTokenRefresh: false },
      },
      {
        input: { allowThrowOnError: false, skipTokenRefresh: false },
        normalized: { allowThrowOnError: false, skipTokenRefresh: false },
      },
      {
        input: { allowThrowOnError: true, skipTokenRefresh: false },
        normalized: { allowThrowOnError: true, skipTokenRefresh: false },
      },
      {
        input: { allowThrowOnError: true, skipTokenRefresh: true },
        normalized: { allowThrowOnError: true, skipTokenRefresh: true },
      },
      {
        input: { allowThrowOnError: false, skipTokenRefresh: true },
        normalized: { allowThrowOnError: false, skipTokenRefresh: true },
      },
    ];

    it.each(testData)("normalize input $input options correctly", async ({ input, normalized }) => {
      const messages = new Subject<FullSyncFinishedMessage>();
      messageListener.messages$.mockReturnValue(messages);
      const fullSyncPromise = sut.fullSync(true, input);
      expect(sut.syncInProgress).toBe(true);

      const requestId = getAndAssertRequestId({
        forceSync: true,
        options: normalized,
      });

      // Pretend the sync has finished
      messages.next({ successfully: true, errorMessage: null, requestId: requestId });

      const result = await fullSyncPromise;

      expect(sut.syncInProgress).toBe(false);
      expect(result).toBe(true);
    });

    it("correctly relays an unsuccessful fullSync but does not throw if allowThrowOnError = false", async () => {
      const messages = new Subject<FullSyncFinishedMessage>();
      messageListener.messages$.mockReturnValue(messages);
      const fullSyncPromise = sut.fullSync(false, false);
      expect(sut.syncInProgress).toBe(true);

      const requestId = getAndAssertRequestId({
        forceSync: false,
        options: { allowThrowOnError: false, skipTokenRefresh: false },
      });

      // Pretend the sync has finished
      messages.next({
        successfully: false,
        errorMessage: "Error while syncing",
        requestId: requestId,
      });

      const result = await fullSyncPromise;

      expect(sut.syncInProgress).toBe(false);
      expect(result).toBe(false);
    });

    it("correctly relays an unsuccessful fullSync but and will throw if allowThrowOnError = true", async () => {
      const messages = new Subject<FullSyncFinishedMessage>();
      messageListener.messages$.mockReturnValue(messages);
      const fullSyncPromise = sut.fullSync(true, true);
      expect(sut.syncInProgress).toBe(true);

      const requestId = getAndAssertRequestId({
        forceSync: true,
        options: { allowThrowOnError: true, skipTokenRefresh: false },
      });

      // Pretend the sync has finished
      messages.next({
        successfully: false,
        errorMessage: "Error while syncing",
        requestId: requestId,
      });

      await expect(fullSyncPromise).rejects.toThrow("Error while syncing");

      expect(sut.syncInProgress).toBe(false);
    });
  });
});
