import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { FakeAccountService, mockAccountInfoWith, mockAccountServiceWith } from "../../../spec";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { UserId } from "../../types/guid";
import { PinServiceAbstraction } from "../pin/pin.service.abstraction";
import { VaultTimeoutAction, VaultTimeoutSettingsService } from "../vault-timeout";

import { DefaultProcessReloadService } from "./default-process-reload.service";

const RELOAD_MESSAGE = "reloadProcess";
const AFU = "AfterFirstUnlock";
const BFU = "BeforeFirstUnlock";

describe("DefaultProcessReloadService", () => {
  const activeUserId = "active-user" as UserId;
  const otherUserId = "other-user" as UserId;

  let pinService: MockProxy<PinServiceAbstraction>;
  let messagingService: MockProxy<MessagingService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let authService: MockProxy<AuthService>;
  let accountService: FakeAccountService;
  let sut: DefaultProcessReloadService;

  beforeEach(async () => {
    pinService = mock();
    messagingService = mock();
    vaultTimeoutSettingsService = mock();
    authService = mock();

    // Two locked accounts; A is active.
    accountService = mockAccountServiceWith(activeUserId);
    await accountService.addAccount(otherUserId, mockAccountInfoWith());
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    pinService.isPinDecryptionAvailable.mockResolvedValue(true);
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      of(VaultTimeoutAction.Lock),
    );

    sut = new DefaultProcessReloadService(
      pinService,
      messagingService,
      vaultTimeoutSettingsService,
      accountService,
      mock<LogService>(),
      authService,
    );
  });

  describe.each([
    ["active account", activeUserId],
    ["inactive account", otherUserId],
  ])("%s", (_, afuUserId) => {
    it("does not reload when PIN is in AFU mode, and the client is AFU", async () => {
      pinService.getPinLockType.mockImplementation(async (userId) =>
        userId === afuUserId ? AFU : undefined,
      );

      await sut.reloadProcess();

      expect(messagingService.send).not.toHaveBeenCalled();
    });
  });

  it("does reload when PIN is in AFU mode, and the client is BFU", async () => {
    // Not unlocked since the last reload, so there is nothing to wipe.
    pinService.getPinLockType.mockResolvedValue(AFU);
    pinService.isPinDecryptionAvailable.mockResolvedValue(false);

    await sut.reloadProcess();

    expect(messagingService.send).toHaveBeenCalledWith(RELOAD_MESSAGE);
  });

  it("does reload when all accounts are locked, without a PIN in AFU mode", async () => {
    pinService.getPinLockType.mockResolvedValue(BFU);

    await sut.reloadProcess();

    expect(messagingService.send).toHaveBeenCalledWith(RELOAD_MESSAGE);
  });

  it("does not reload while an account is unlocked", async () => {
    authService.getAuthStatus.mockImplementation(async (userId) =>
      userId === otherUserId ? AuthenticationStatus.Unlocked : AuthenticationStatus.Locked,
    );

    await sut.reloadProcess();

    expect(messagingService.send).not.toHaveBeenCalled();
  });
});
