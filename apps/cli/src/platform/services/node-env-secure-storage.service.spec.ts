import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";

import { NodeEnvSecureStorageService } from "./node-env-secure-storage.service";

describe("NodeEnvSecureStorageService", () => {
  let storage: MockProxy<AbstractStorageService>;
  let sut: NodeEnvSecureStorageService;

  beforeEach(() => {
    const stored = new Map<string, string>();
    storage = mock<AbstractStorageService>();
    storage.get.mockImplementation(async (key) => stored.get(key) as any);
    storage.save.mockImplementation(async (key, value) => void stored.set(key, value as string));

    sut = new NodeEnvSecureStorageService(storage, mock<LogService>(), mock<EncryptService>());

    // Like the real encryption, a fresh IV makes every ciphertext different.
    let iv = 0;
    jest.spyOn(sut as any, "encrypt").mockImplementation(async (value) => `${iv++}:${value}`);
    jest
      .spyOn(sut as any, "decrypt")
      .mockImplementation(async (value: string) => value.slice(value.indexOf(":") + 1));
  });

  it("does not rewrite an unchanged value", async () => {
    await sut.save("key", "secret");
    await sut.save("key", "secret");

    expect(storage.save).toHaveBeenCalledTimes(1);
    await expect(sut.get("key")).resolves.toBe("secret");
  });

  it("writes a changed value", async () => {
    await sut.save("key", "secret");
    await sut.save("key", "other");

    expect(storage.save).toHaveBeenCalledTimes(2);
    await expect(sut.get("key")).resolves.toBe("other");
  });

  it("removes the value when saving null", async () => {
    await sut.save("key", "secret");
    await sut.save("key", null);

    expect(storage.remove).toHaveBeenCalledWith("__PROTECTED__key");
  });
});
