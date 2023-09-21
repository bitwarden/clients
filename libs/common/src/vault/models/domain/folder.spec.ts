import { mockEnc, mockFromJson } from "../../../../spec";
import { EncryptedString, EncString } from "../../../platform/models/domain/enc-string";
import { FolderData } from "../../models/data/folder.data";
import { Folder } from "../../models/domain/folder";

describe("Folder", () => {
  let data: FolderData;

  beforeEach(() => {
    data = {
      id: "id",
      name: "encName",
      revisionDate: "2022-01-31T12:00:00.000Z",
    };
  });

  it("Convert", () => {
    const field = new Folder(data);

    expect(field).toEqual({
      id: "id",
      name: { encryptedString: "encName", encryptionType: 0 },
      revisionDate: new Date("2022-01-31T12:00:00.000Z"),
    });
  });

  it("Decrypt", async () => {
    const folder = new Folder();
    folder.id = "id";
    folder.name = mockEnc("encName");
    folder.revisionDate = new Date("2022-01-31T12:00:00.000Z");

    const view = await folder.decrypt();

    expect(view).toEqual({
      id: "id",
      name: "encName",
      revisionDate: new Date("2022-01-31T12:00:00.000Z"),
    });
  });

  describe("fromJSON", () => {
    jest.mock("../../../platform/models/domain/enc-string");
    jest.spyOn(EncString, "fromJSON").mockImplementation(mockFromJson);

    it("initializes nested objects", () => {
      const revisionDate = new Date("2022-08-04T01:06:40.441Z");
      const actual = Folder.fromJSON({
        revisionDate: revisionDate.toISOString(),
        name: "name" as EncryptedString,
        id: "id",
      });

      const expected = {
        revisionDate: revisionDate,
        name: "name_fromJSON",
        id: "id",
      };

      expect(actual).toMatchObject(expected);
    });
  });
});
