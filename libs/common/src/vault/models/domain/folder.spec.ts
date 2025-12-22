import { mock, MockProxy } from "jest-mock-extended";

import {
  makeEncString,
  makeSymmetricCryptoKey,
  mockContainerService,
  mockEnc,
  mockFromJson,
} from "../../../../spec";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncryptedString, EncString } from "../../../key-management/crypto/models/enc-string";
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
    mockContainerService();
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

    const view = await folder.decrypt(null);

    expect(view).toEqual({
      id: "id",
      name: "encName",
      revisionDate: new Date("2022-01-31T12:00:00.000Z"),
    });
  });

  describe("fromJSON", () => {
    jest.mock("../../../key-management/crypto/models/enc-string");
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

      expect(view).toEqual({
        name: "encName",
      });
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
