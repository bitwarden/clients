import { FolderView } from "./folder.view";

describe("FolderView", () => {
  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      const revisionDate = new Date("2022-08-04T01:06:40.441Z");
      const actual = FolderView.fromJSON({
        revisionDate: revisionDate.toISOString(),
        name: "name",
        id: "id",
      });

      const expected = {
        revisionDate: revisionDate,
        name: "name",
        id: "id",
      };

      expect(actual).toMatchObject(expected);
    });
  });
});
