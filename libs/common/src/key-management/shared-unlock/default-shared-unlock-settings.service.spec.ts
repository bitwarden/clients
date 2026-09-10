import { firstValueFrom } from "rxjs";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { ClientType } from "../../enums";
import { UserId } from "../../types/guid";

import { DefaultSharedUnlockSettingsService } from "./default-shared-unlock-settings.service";

describe("DefaultSharedUnlockSettingsService", () => {
  const userId = "8796a0d1-a4b0-4a1e-9c3b-1b0b1b0b1b0b" as UserId;

  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
  });

  function sutFor(clientType: ClientType): DefaultSharedUnlockSettingsService {
    return new DefaultSharedUnlockSettingsService(stateProvider, clientType);
  }

  describe("allowSharingUnlockStateWithDesktop$", () => {
    it("defaults to on for the CLI, which has no permission prompt or settings UI", async () => {
      const sut = sutFor(ClientType.Cli);

      expect(await firstValueFrom(sut.allowSharingUnlockStateWithDesktop$(userId))).toBe(true);
    });

    it.each([ClientType.Browser, ClientType.Desktop, ClientType.Web])(
      "defaults to off for %s",
      async (clientType) => {
        const sut = sutFor(clientType);

        expect(await firstValueFrom(sut.allowSharingUnlockStateWithDesktop$(userId))).toBe(false);
      },
    );

    it.each([ClientType.Browser, ClientType.Cli])(
      "honours an explicitly stored value on %s over the default",
      async (clientType) => {
        const sut = sutFor(clientType);

        await sut.setAllowSharingUnlockStateWithDesktop(clientType === ClientType.Cli, userId);

        expect(await firstValueFrom(sut.allowSharingUnlockStateWithDesktop$(userId))).toBe(
          clientType === ClientType.Cli,
        );
      },
    );

    it("can be switched off on the CLI", async () => {
      const sut = sutFor(ClientType.Cli);

      await sut.setAllowSharingUnlockStateWithDesktop(false, userId);

      expect(await firstValueFrom(sut.allowSharingUnlockStateWithDesktop$(userId))).toBe(false);
    });
  });
});
