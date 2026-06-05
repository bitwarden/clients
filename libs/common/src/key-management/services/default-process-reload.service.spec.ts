import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { BiometricStateService } from "@bitwarden/key-management";

import { mockAccountServiceWith } from "../../../spec/fake-account-service";
import { FakeStateProvider } from "../../../spec/fake-state-provider";
import { AccountService } from "../../auth/abstractions/account.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { VaultTimeoutSettingsService } from "../../key-management/vault-timeout";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { UserId } from "../../types/guid";
import { PinServiceAbstraction } from "../pin/pin.service.abstraction";

import { DefaultProcessReloadService } from "./default-process-reload.service";

describe("DefaultProcessReloadService", () => {
  let pinService: MockProxy<PinServiceAbstraction>;
  let messagingService: MockProxy<MessagingService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let biometricStateService: MockProxy<BiometricStateService>;
  let accountService: MockProxy<AccountService>;
  let logService: MockProxy<LogService>;
  let authService: MockProxy<AuthService>;
  let stateProvider: FakeStateProvider;

  let service: DefaultProcessReloadService;

  beforeEach(() => {
    pinService = mock<PinServiceAbstraction>();
    messagingService = mock<MessagingService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    biometricStateService = mock<BiometricStateService>();
    accountService = mock<AccountService>();
    logService = mock<LogService>();
    authService = mock<AuthService>();
    stateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));

    // No active/unlocked accounts so the reload proceeds when not disabled.
    accountService.accounts$ = of(null);
    accountService.activeAccount$ = of(null);
    biometricStateService.fingerprintValidated$ = of(false);

    service = new DefaultProcessReloadService(
      pinService,
      messagingService,
      null,
      vaultTimeoutSettingsService,
      biometricStateService,
      accountService,
      logService,
      authService,
      stateProvider,
    );
  });

  it("performs the reload when disableProcessReload is not set", async () => {
    await service.startProcessReload();

    expect(messagingService.send).toHaveBeenCalledWith("reloadProcess");
  });

  it("skips the reload when disableProcessReload is true", async () => {
    await service.setDisableProcessReload(true);

    await service.startProcessReload();

    expect(messagingService.send).not.toHaveBeenCalled();
  });
});
