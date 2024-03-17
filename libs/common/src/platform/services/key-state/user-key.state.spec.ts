import { mock } from "jest-mock-extended";

import { makeStaticByteArray } from "../../../../spec";
import { UserId } from "../../../types/guid";
import { UserKey, UserPrivateKey, UserPublicKey } from "../../../types/key";
import { CryptoFunctionService } from "../../abstractions/crypto-function.service";
import { EncryptService } from "../../abstractions/encrypt.service";
import { EncryptionType } from "../../enums";
import { Utils } from "../../misc/utils";
import { EncString } from "../../models/domain/enc-string";
import { CryptoService } from "../crypto.service";

import {
  USER_ENCRYPTED_PRIVATE_KEY,
  USER_EVER_HAD_USER_KEY,
  USER_PRIVATE_KEY,
  USER_PUBLIC_KEY,
} from "./user-key.state";

function makeEncString(data?: string) {
  data ??= Utils.newGuid();
  return new EncString(EncryptionType.AesCbc256_HmacSha256_B64, data, "test", "test");
}

describe("Ever had user key", () => {
  const sut = USER_EVER_HAD_USER_KEY;

  it("should deserialize ever had user key", () => {
    const everHadUserKey = true;

    const result = sut.deserializer(JSON.parse(JSON.stringify(everHadUserKey)));

    expect(result).toEqual(everHadUserKey);
  });
});

describe("Encrypted private key", () => {
  const sut = USER_ENCRYPTED_PRIVATE_KEY;

  it("should deserialize encrypted private key", () => {
    const encryptedPrivateKey = makeEncString().encryptedString;

    const result = sut.deserializer(JSON.parse(JSON.stringify(encryptedPrivateKey)));

    expect(result).toEqual(encryptedPrivateKey);
  });
});

describe("User public key", () => {
  const sut = USER_PUBLIC_KEY;
  const userPrivateKey = makeStaticByteArray(64, 1) as UserPrivateKey;
  const userPublicKey = makeStaticByteArray(64, 2) as UserPublicKey;

  it("should deserialize user public key", () => {
    const userPublicKey = makeStaticByteArray(64, 1);

    const result = sut.deserialize(JSON.parse(JSON.stringify(userPublicKey)));

    expect(result).toEqual(userPublicKey);
  });

  it("should derive user public key", async () => {
    const cryptoFunctionService = mock<CryptoFunctionService>();
    cryptoFunctionService.rsaExtractPublicKey.mockResolvedValue(userPublicKey);

    const result = await sut.derive(userPrivateKey, { cryptoFunctionService });

    expect(result).toEqual(userPublicKey);
  });
});

describe("Derived decrypted private key", () => {
  const sut = USER_PRIVATE_KEY;
  const userId = "userId" as UserId;
  const userKey = mock<UserKey>();
  const encryptedPrivateKey = makeEncString().encryptedString;
  const decryptedPrivateKey = makeStaticByteArray(64, 1);

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should deserialize decrypted private key", () => {
    const decryptedPrivateKey = makeStaticByteArray(64, 1);

    const result = sut.deserialize(JSON.parse(JSON.stringify(decryptedPrivateKey)));

    expect(result).toEqual(decryptedPrivateKey);
  });

  it("should derive decrypted private key", async () => {
    const cryptoService = mock<CryptoService>();
    cryptoService.getUserKey.mockResolvedValue(userKey);
    const encryptService = mock<EncryptService>();
    encryptService.decryptToBytes.mockResolvedValue(decryptedPrivateKey);

    const result = await sut.derive([userId, encryptedPrivateKey], {
      encryptService,
      cryptoService,
    });

    expect(result).toEqual(decryptedPrivateKey);
  });

  it("should handle null input values", async () => {
    const cryptoService = mock<CryptoService>();
    cryptoService.getUserKey.mockResolvedValue(userKey);
    const encryptService = mock<EncryptService>();

    const result = await sut.derive([userId, null], {
      encryptService,
      cryptoService,
    });

    expect(result).toEqual(null);
  });

  it("should handle null user key", async () => {
    const cryptoService = mock<CryptoService>();
    cryptoService.getUserKey.mockResolvedValue(null);
    const encryptService = mock<EncryptService>();

    const result = await sut.derive([userId, encryptedPrivateKey], {
      encryptService,
      cryptoService,
    });

    expect(result).toEqual(null);
  });
});
