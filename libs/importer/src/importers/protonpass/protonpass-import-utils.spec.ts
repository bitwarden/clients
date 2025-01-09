import { processNames } from "./protonpass-import-utils";

describe("processNames", () => {
  it("should use only fullName to map names if it contains at least three words, ignoring individual name fields", () => {
    const result = processNames("Alice Beth Carter", "Kevin", "", "");
    expect(result).toEqual({
      mappedFirstName: "Alice",
      mappedMiddleName: "Beth",
      mappedLastName: "Carter",
    });
  });

  it("should map extra words to the middle name if fullName contains more than three words", () => {
    const result = processNames("Alice Beth Middle Carter", "", "", "");
    expect(result).toEqual({
      mappedFirstName: "Alice",
      mappedMiddleName: "Beth Middle",
      mappedLastName: "Carter",
    });
  });

  it("should map names correctly even if fullName has words separated by more than one space", () => {
    const result = processNames("Alice    Carter", "", "", "");
    expect(result).toEqual({
      mappedFirstName: "Alice",
      mappedMiddleName: "",
      mappedLastName: "Carter",
    });
  });

  it("should handle a single name in fullName and use middleName and lastName to populate rest of names", () => {
    const result = processNames("Alice", "", "Beth", "Carter");
    expect(result).toEqual({
      mappedFirstName: "Alice",
      mappedMiddleName: "Beth",
      mappedLastName: "Carter",
    });
  });

  it("should correctly map fullName when it only contains two words", () => {
    const result = processNames("Alice Carter", "", "", "");
    expect(result).toEqual({
      mappedFirstName: "Alice",
      mappedMiddleName: "",
      mappedLastName: "Carter",
    });
  });

  it("should map middle name from middleName if fullName only contains two words", () => {
    const result = processNames("Alice Carter", "", "Beth", "");
    expect(result).toEqual({
      mappedFirstName: "Alice",
      mappedMiddleName: "Beth",
      mappedLastName: "Carter",
    });
  });

  it("should fall back to firstName, middleName, and lastName if fullName is empty", () => {
    const result = processNames("", "Alice", "Beth", "Carter");
    expect(result).toEqual({
      mappedFirstName: "Alice",
      mappedMiddleName: "Beth",
      mappedLastName: "Carter",
    });
  });
});
