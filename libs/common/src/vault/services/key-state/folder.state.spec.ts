import { FOLDER_DECRYPTED_FOLDERS, FOLDER_ENCRYPTED_FOLDERS } from "./folder.state";

describe("encrypted folders", () => {
  const sut = FOLDER_ENCRYPTED_FOLDERS;

  it("should deserialize encrypted folders", async () => {
    const inputObj = {
      id: {
        id: "id",
        name: "encName",
        revisionDate: "2024-01-31T12:00:00.000Z",
      },
    };

    const expectedFolderData = {
      id: { id: "id", name: "encName", revisionDate: "2024-01-31T12:00:00.000Z" },
    };

    const result = sut.deserializer(JSON.parse(JSON.stringify(inputObj)));

    expect(result).toEqual(expectedFolderData);
  });
});

describe("derived decrypted folders", () => {
  const sut = FOLDER_DECRYPTED_FOLDERS;

  it("should deserialize decrypted folders", async () => {
    const inputObj = [
      {
        id: "id",
        name: "encName",
        revisionDate: "2024-01-31T12:00:00.000Z",
      },
    ];

    const expectedFolderView = [
      {
        id: "id",
        name: "encName",
        revisionDate: new Date("2024-01-31T12:00:00.000Z"),
      },
    ];

    const result = sut.deserializer(JSON.parse(JSON.stringify(inputObj)));

    expect(result).toEqual(expectedFolderView);
  });

  it("should handle null input", async () => {
    const result = sut.deserializer(null);
    expect(result).toEqual([]);
  });
});
