import { SymmetricCryptoKey } from "@bitwarden/common/key-management/crypto/models/domain/symmetric-crypto-key";

import { mockFromJson } from "../../../../spec";

import { AttachmentView } from "./attachment.view";

jest.mock("@bitwarden/common/key-management/crypto/models/domain/symmetric-crypto-key");

describe("AttachmentView", () => {
  it("fromJSON initializes nested objects", () => {
    jest.spyOn(SymmetricCryptoKey, "fromJSON").mockImplementation(mockFromJson);

    const actual = AttachmentView.fromJSON({
      key: "encKeyB64" as any,
    });

    expect(actual.key).toEqual("encKeyB64_fromJSON");
  });
});
