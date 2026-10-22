import { parseCommaSeparatedEmails } from "./parse-comma-separated-emails";

describe("parseCommaSeparatedEmails", () => {
  it("returns an empty array for null, undefined, or empty input", () => {
    expect(parseCommaSeparatedEmails(null)).toEqual([]);
    expect(parseCommaSeparatedEmails(undefined)).toEqual([]);
    expect(parseCommaSeparatedEmails("")).toEqual([]);
    expect(parseCommaSeparatedEmails("   ")).toEqual([]);
  });

  it("splits on commas and trims surrounding whitespace", () => {
    expect(parseCommaSeparatedEmails(" first@example.com ,second@example.com ")).toEqual([
      "first@example.com",
      "second@example.com",
    ]);
  });

  it("drops empty entries left by stray or trailing commas", () => {
    expect(parseCommaSeparatedEmails("first@example.com,,second@example.com, , ")).toEqual([
      "first@example.com",
      "second@example.com",
    ]);
  });

  it("preserves duplicates so callers decide how to de-duplicate", () => {
    expect(parseCommaSeparatedEmails("dupe@example.com,dupe@example.com")).toEqual([
      "dupe@example.com",
      "dupe@example.com",
    ]);
  });
});
