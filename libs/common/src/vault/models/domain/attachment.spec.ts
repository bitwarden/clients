import { mock, MockProxy } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { makeStaticByteArray, mockContainerService, mockEnc, mockFromJson } from "../../../../spec";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncryptedString, EncString } from "../../../key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { AttachmentData } from "../../models/data/attachment.data";
import { Attachment } from "../../models/domain/attachment";

describe("Attachment", () => {
  let data: AttachmentData;

  beforeEach(() => {
    data = {
      id: "id",
      url: "url",
      fileName: "fileName",
      key: "key",
      size: "1100",
      sizeName: "1.1 KB",
    };
  });

  it("Convert from empty", () => {
    const data = new AttachmentData();
    const attachment = new Attachment(data);

    expect(attachment).toEqual({
      id: undefined,
      url: undefined,
      size: undefined,
      sizeName: undefined,
      key: undefined,
      fileName: undefined,
    });
    expect(data.id).toBeUndefined();
    expect(data.url).toBeUndefined();
    expect(data.fileName).toBeUndefined();
    expect(data.key).toBeUndefined();
    expect(data.size).toBeUndefined();
    expect(data.sizeName).toBeUndefined();
  });

  it("Convert", () => {
    const attachment = new Attachment(data);

    expect(attachment).toEqual({
      size: "1100",
      id: "id",
      url: "url",
      sizeName: "1.1 KB",
      fileName: { encryptedString: "fileName", encryptionType: 0 },
      key: { encryptedString: "key", encryptionType: 0 },
    });
  });

  it("toAttachmentData", () => {
    const attachment = new Attachment(data);
    expect(attachment.toAttachmentData()).toEqual(data);
  });

  describe("decrypt", () => {
    let keyService: MockProxy<KeyService>;
    let encryptService: MockProxy<EncryptService>;

    beforeEach(() => {
      const containerService = mockContainerService();
      keyService = containerService.keyService as MockProxy<KeyService>;
      encryptService = containerService.encryptService as MockProxy<EncryptService>;
    });

    it("expected output", async () => {
      const attachment = new Attachment();
      attachment.id = "id";
      attachment.url = "url";
      attachment.size = "1100";
      attachment.sizeName = "1.1 KB";
      attachment.key = mockEnc("key");
      attachment.fileName = mockEnc("fileName");

      encryptService.decryptFileData.mockResolvedValue(makeStaticByteArray(32));
      encryptService.unwrapSymmetricKey.mockResolvedValue(
        new SymmetricCryptoKey(makeStaticByteArray(64)),
      );

      const userKey = new SymmetricCryptoKey(makeStaticByteArray(64));
      const view = await attachment.decrypt(userKey);

      expect(view).toEqual({
        id: "id",
        url: "url",
        size: "1100",
        sizeName: "1.1 KB",
        fileName: "fileName",
        key: expect.any(SymmetricCryptoKey),
        encryptedKey: attachment.key,
      });
    });

    describe("decrypts attachment.key", () => {
      let attachment: Attachment;

      beforeEach(() => {
        attachment = new Attachment();
        attachment.key = mock<EncString>();
      });

      it("uses the provided key without depending on KeyService", async () => {
        const providedKey = mock<SymmetricCryptoKey>();

        await attachment.decrypt(providedKey, "");

        expect(keyService.getUserKey).not.toHaveBeenCalled();
        expect(encryptService.unwrapSymmetricKey).toHaveBeenCalledWith(attachment.key, providedKey);
      });
    });
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      jest.spyOn(EncString, "fromJSON").mockImplementation(mockFromJson);

      const actual = Attachment.fromJSON({
        key: "myKey" as EncryptedString,
        fileName: "myFileName" as EncryptedString,
      });

      expect(actual).toEqual({
        key: "myKey_fromJSON",
        fileName: "myFileName_fromJSON",
      });
      expect(actual).toBeInstanceOf(Attachment);
    });

    it("returns undefined if object is null", () => {
      expect(Attachment.fromJSON(null)).toBeUndefined();
    });
  });

  describe("toSdkAttachment", () => {
    it("should map to SDK Attachment", () => {
      const attachment = new Attachment(data);

      const sdkAttachment = attachment.toSdkAttachment();

      expect(sdkAttachment).toEqual({
        id: "id",
        url: "url",
        size: "1100",
        sizeName: "1.1 KB",
        fileName: "fileName",
        key: "key",
      });
    });
  });
});
