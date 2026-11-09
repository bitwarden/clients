import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";
import { LockService, LockSource } from "@bitwarden/unlock";

import { NodeEnvSecureStorageService } from "../../platform/services/node-env-secure-storage.service";

import { LockCommand } from "./lock.command";

describe("LockCommand", () => {
  const userId = "user-id" as UserId;
  const validSessionKey = Utils.fromBufferToB64(new Uint8Array(64).fill(1).buffer);

  let lockService: jest.Mocked<LockService>;
  let logService: jest.Mocked<LogService>;
  let secureStorage: NodeEnvSecureStorageService;
  let lockCommand: LockCommand;

  beforeEach(() => {
    process.env.BW_SESSION = validSessionKey;

    lockService = mock<LockService>();
    logService = mock<LogService>();
    const storageService = mock<AbstractStorageService>();
    storageService.get.mockResolvedValue("stored-encrypted-value");
    secureStorage = new NodeEnvSecureStorageService(
      storageService,
      logService,
      mock<EncryptService>(),
    );

    lockCommand = new LockCommand(lockService, mockAccountServiceWith(userId));
  });

  afterEach(() => {
    delete process.env.BW_SESSION;
  });

  it("locks the active user", async () => {
    await lockCommand.run();

    expect(lockService.lock).toHaveBeenCalledWith(userId, LockSource.Manual);
  });

  it("removes BW_SESSION from the environment", async () => {
    await lockCommand.run();

    expect("BW_SESSION" in process.env).toBe(false);
  });

  it("leaves secure storage with no session key to decode", async () => {
    await lockCommand.run();

    const value = await secureStorage.get("any-key");

    expect(value).toBeNull();
    expect(logService.info).not.toHaveBeenCalledWith("Session key is invalid.");
  });
});
