import { makeEncString } from "../../../../spec";

import { USER_ENCRYPTED_ORGANIZATION_KEYS } from "./org-keys.state";

describe("encrypted org keys", () => {
  const sut = USER_ENCRYPTED_ORGANIZATION_KEYS;

  it("should deserialize encrypted org keys", () => {
    const encryptedOrgKeys = {
      "org-id-1": {
        type: "organization",
        key: makeEncString().encryptedString,
      },
      "org-id-2": {
        type: "provider",
        key: makeEncString().encryptedString,
        providerId: "provider-id-2",
      },
    };

    const result = sut.deserializer(JSON.parse(JSON.stringify(encryptedOrgKeys)));

    expect(result).toEqual(encryptedOrgKeys);
  });
});
