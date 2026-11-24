import { EncString } from "@bitwarden/sdk-internal";

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
      fileName: "fileName",
      key: "key",
    });
  });

  it("toAttachmentData", () => {
    const attachment = new Attachment(data);
    expect(attachment.toAttachmentData()).toEqual(data);
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      const actual = Attachment.fromJSON({
        key: "myKey" as EncString,
        fileName: "myFileName" as EncString,
      });

      expect(actual).toEqual({
        key: "myKey",
        fileName: "myFileName",
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
