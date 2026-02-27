import { makeEncString } from "../../../../spec";

import { USER_ENCRYPTED_PROVIDER_KEYS } from "./provider-keys.state";

describe("encrypted provider keys", () => {
  const sut = USER_ENCRYPTED_PROVIDER_KEYS;

  it("should deserialize encrypted provider keys", () => {
    const encryptedProviderKeys = {
      "provider-id-1": makeEncString().encryptedString,
      "provider-id-2": makeEncString().encryptedString,
    };

    const result = sut.deserializer(JSON.parse(JSON.stringify(encryptedProviderKeys)));

    expect(result).toEqual(encryptedProviderKeys);
  });
});
