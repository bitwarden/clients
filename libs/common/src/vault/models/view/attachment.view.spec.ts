import { AttachmentView as SdkAttachmentView } from "@bitwarden/sdk-internal";

import { mockFromJson } from "../../../../spec";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";

import { AttachmentView } from "./attachment.view";

jest.mock("../../../platform/models/domain/symmetric-crypto-key");

describe("AttachmentView", () => {
  it("fromJSON initializes nested objects", () => {
    jest.spyOn(SymmetricCryptoKey, "fromJSON").mockImplementation(mockFromJson);

    const actual = AttachmentView.fromJSON({
      key: "encKeyB64" as any,
    });

    expect(actual.key).toEqual("encKeyB64_fromJSON");
  });

  describe("fromSdkAttachmentView", () => {
    it("should return undefined when the input is null", () => {
      const result = AttachmentView.fromSdkAttachmentView(null as unknown as any);
      expect(result).toBeUndefined();
    });

    it("should return an AttachmentView from an SdkAttachmentView", () => {
      jest.spyOn(SymmetricCryptoKey, "fromString").mockReturnValue("mockKey" as any);

      const sdkAttachmentView = {
        id: "id",
        url: "url",
        size: "size",
        sizeName: "sizeName",
        fileName: "fileName",
        key: "encKeyB64_fromString",
        decryptedKey: "decryptedKey_B64",
      } as SdkAttachmentView;

      const result = AttachmentView.fromSdkAttachmentView(sdkAttachmentView);

      expect(result).toMatchObject({
        id: "id",
        url: "url",
        size: "size",
        sizeName: "sizeName",
        fileName: "fileName",
        key: "mockKey",
        encryptedKey: new EncString(sdkAttachmentView.key as string),
      });

      expect(SymmetricCryptoKey.fromString).toHaveBeenCalledWith("decryptedKey_B64");
    });
  });

  describe("toSdkAttachmentView", () => {
    it("should convert AttachmentView to SdkAttachmentView", () => {
      const mockKey = {
        toBase64: jest.fn().mockReturnValue("keyB64"),
      } as any;

      const attachmentView = new AttachmentView();
      attachmentView.id = "id";
      attachmentView.url = "url";
      attachmentView.size = "size";
      attachmentView.sizeName = "sizeName";
      attachmentView.fileName = "fileName";
      attachmentView.encryptedKey = new EncString("encKeyB64");
      attachmentView.key = mockKey;

      const result = attachmentView.toSdkAttachmentView();

      expect(result).toEqual({
        id: "id",
        url: "url",
        size: "size",
        sizeName: "sizeName",
        fileName: "fileName",
        key: "encKeyB64",
        decryptedKey: "keyB64",
      });
    });
  });
});
