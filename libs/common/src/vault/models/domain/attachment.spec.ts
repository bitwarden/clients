// eslint-disable-next-line no-restricted-imports
import { EncryptedString, EncString } from "@bitwarden/legacy-crypto";

import { mockFromJson } from "../../../../spec";
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
