import { mock, MockProxy } from "jest-mock-extended";

import { makeEncString, makeSymmetricCryptoKey, mockEnc, mockFromJson } from "../../../../spec";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
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

  describe("constructor", () => {
    it("initializes properties from FolderData", () => {
      const revisionDate = new Date("2022-08-04T01:06:40.441Z");
      const folder = new Folder({
        id: "id",
        name: "name",
        revisionDate: revisionDate.toISOString(),
      });

      expect(folder.id).toBe("id");
      expect(folder.revisionDate).toEqual(revisionDate);
      expect(folder.name).toBeInstanceOf(EncString);
      expect((folder.name as EncString).encryptedString).toBe("name");
    });

    it("initializes empty properties when no FolderData is provided", () => {
      const folder = new Folder();

      expect(folder.id).toBe(undefined);
      expect(folder.name).toBe(undefined);
      expect(folder.revisionDate).toBeInstanceOf(Date);
    });
  });

  describe("fromJSON", () => {
    jest.mock("../../../key-management/crypto/models/enc-string");
    jest.spyOn(EncString, "fromJSON").mockImplementation(mockFromJson);

    it("initializes nested objects", () => {
      const revisionDate = new Date("2022-08-04T01:06:40.441Z");
      const actual = Folder.fromJSON({
        revisionDate: revisionDate.toISOString(),
        name: "name",
        id: "id",
      });

      expect(actual?.id).toBe("id");
      expect(actual?.revisionDate).toEqual(revisionDate);
      expect(actual?.name).toBeInstanceOf(EncString);
      expect((actual?.name as EncString).encryptedString).toBe("name_fromJSON");
    });
  });

  describe("decryptWithKey", () => {
    let encryptService: MockProxy<EncryptService>;
    const key = makeSymmetricCryptoKey(64);

    beforeEach(() => {
      encryptService = mock<EncryptService>();
      // Platform code is not migrated yet
      encryptService.decryptString.mockImplementation((_value, _key) => {
        return Promise.resolve("encName");
      });
    });

    it("decrypts the name", async () => {
      const folder = new Folder();
      folder.name = makeEncString("encName");

      const view = await folder.decryptWithKey(key, encryptService);

      expect(view.name).toBe("encName");
    });

    it("assigns the folder id and revision date", async () => {
      const folder = new Folder();
      folder.id = "id";
      folder.revisionDate = new Date("2022-01-31T12:00:00.000Z");

      const view = await folder.decryptWithKey(key, encryptService);

      expect(view).toEqual(
        expect.objectContaining({
          id: "id",
          revisionDate: new Date("2022-01-31T12:00:00.000Z"),
        }),
      );
    });
  });
});
