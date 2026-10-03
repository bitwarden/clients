import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
// eslint-disable-next-line no-restricted-imports
import { CsprngArray } from "@bitwarden/legacy-crypto";
import { PureCrypto, SymmetricKey } from "@bitwarden/sdk-internal";

import { CliSessionKeyService, SessionKeyLifetime } from "./cli-session-key.service";

describe("CliSessionKeyService", () => {
  let sut: CliSessionKeyService;

  const suppliedKey = Utils.fromBufferToB64(new Uint8Array(64).fill(1) as CsprngArray);
  const mintedKey = Utils.fromBufferToB64(new Uint8Array(64).fill(2) as CsprngArray);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BW_SESSION;

    Object.defineProperty(SdkLoadService, "Ready", {
      value: Promise.resolve(),
      writable: true,
      configurable: true,
    });
    jest.spyOn(PureCrypto, "make_aes256_cbc_hmac_key").mockReturnValue(mintedKey as SymmetricKey);

    sut = new CliSessionKeyService();
  });

  describe("ensure", () => {
    it("keeps a session key the user supplied", async () => {
      process.env.BW_SESSION = suppliedKey;

      expect(await sut.ensure()).toBe(SessionKeyLifetime.Durable);
      expect(process.env.BW_SESSION).toBe(suppliedKey);
      expect(sut.ephemeral).toBe(false);
      expect(PureCrypto.make_aes256_cbc_hmac_key).not.toHaveBeenCalled();
    });

    it("treats an empty session key as absent", async () => {
      process.env.BW_SESSION = "";

      expect(await sut.ensure()).toBe(SessionKeyLifetime.Ephemeral);
      expect(process.env.BW_SESSION).toBe(mintedKey);
    });

    it("mints an ephemeral session key when the environment has none", async () => {
      expect(await sut.ensure()).toBe(SessionKeyLifetime.Ephemeral);
      expect(process.env.BW_SESSION).toBe(mintedKey);
      expect(sut.ephemeral).toBe(true);
    });

    it("mints at most one key across repeated calls", async () => {
      await sut.ensure();
      await sut.ensure();
      await sut.ensure();

      expect(PureCrypto.make_aes256_cbc_hmac_key).toHaveBeenCalledTimes(1);
    });
  });

  describe("rotate", () => {
    it("replaces the session key with a durable one", async () => {
      await sut.ensure();
      expect(sut.ephemeral).toBe(true);

      await sut.rotate();

      expect(process.env.BW_SESSION).toBe(mintedKey);
      expect(sut.keyLifetime).toBe(SessionKeyLifetime.Durable);
      expect(sut.ephemeral).toBe(false);
    });

    it("refuses to rotate a key that has already unlocked the vault", async () => {
      await sut.ensure();
      sut.markInUse();

      await expect(sut.rotate()).rejects.toThrow(
        "The session key cannot be rotated after it has been used to unlock the vault.",
      );
      expect(process.env.BW_SESSION).toBe(mintedKey);
    });
  });
});
