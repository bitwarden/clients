import { sharedFolderName } from "./shared-folder-name";

describe("sharedFolderName", () => {
  it.each([
    ["Engineering", "Engineering"],
    ["Top level/Next/Deeper/Deepest", "Deepest"],
    ["/Engineering/Backend/", "Backend"],
    ["", ""],
  ])("names %p as %p", (name, expected) => {
    expect(sharedFolderName({ name })).toBe(expected);
  });
});
