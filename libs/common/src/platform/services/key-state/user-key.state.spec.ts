import { EncryptionType } from "../../enums";
import { Utils } from "../../misc/utils";
import { EncString } from "../../models/domain/enc-string";

import { USER_ENCRYPTED_PRIVATE_KEY, USER_EVER_HAD_USER_KEY } from "./user-key.state";

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
