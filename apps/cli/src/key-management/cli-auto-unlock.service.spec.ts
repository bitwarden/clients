import { mock } from "jest-mock-extended";

import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider, StateService } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { CliAutoUnlockService } from "./cli-auto-unlock.service";

describe("CliAutoUnlockService", () => {
  const userId = "user-id" as UserId;
  const userKey = new SymmetricCryptoKey(new Uint8Array(64));

  const stateService = mock<StateService>();
  const platformUtilsService = mock<PlatformUtilsService>();

  let sut: CliAutoUnlockService;

  beforeEach(() => {
    jest.resetAllMocks();
    platformUtilsService.getClientType.mockReturnValue(ClientType.Cli);

    sut = new CliAutoUnlockService(
      mock<KeyService>(),
      stateService,
      mock<StateProvider>(),
      platformUtilsService,
      mock<LogService>(),
    );
  });

  afterEach(() => {
    delete process.env.BW_SESSION;
  });

  it("leaves the stored key untouched when there is no session key", async () => {
    delete process.env.BW_SESSION;

    await sut.setAutoUnlockKey(userId, userKey);

    expect(stateService.setUserKeyAutoUnlock).not.toHaveBeenCalled();
  });

  it("stores the key when a session key is set", async () => {
    process.env.BW_SESSION = "session-key";

    await sut.setAutoUnlockKey(userId, userKey);

    expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(userKey.toBase64(), {
      userId,
    });
  });
});
