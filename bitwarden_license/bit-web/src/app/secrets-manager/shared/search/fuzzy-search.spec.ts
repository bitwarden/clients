import { fuzzySearchFilter } from "./fuzzy-search";

type Item = { id: string; name: string; tags?: string[] };

const items: Item[] = [
  { id: "a1b2c3", name: "Database Password", tags: ["Production"] },
  { id: "d4e5f6", name: "Stripe API Key", tags: ["Billing"] },
  { id: "g7h8i9", name: "Café Token" },
];

function search(text: string): string[] {
  const filter = fuzzySearchFilter<Item>(text, (item) => [item.name, ...(item.tags ?? [])]);
  return items.filter(filter).map((item) => item.name);
}

describe("fuzzySearchFilter", () => {
  it("returns everything when the search is empty or whitespace", () => {
    expect(search("")).toHaveLength(items.length);
    expect(search("   ")).toHaveLength(items.length);
    expect(search(undefined as unknown as string)).toHaveLength(items.length);
  });

  it("still matches exact text, ignoring case", () => {
    expect(search("stripe")).toEqual(["Stripe API Key"]);
    expect(search("DATABASE")).toEqual(["Database Password"]);
  });

  it("still matches other columns exactly, such as the id", () => {
    expect(search("d4e5f6")).toEqual(["Stripe API Key"]);
    expect(search("d4e5")).toEqual(["Stripe API Key"]);
  });

  it("does not forgive typos in columns that are not fuzzy fields, such as the id", () => {
    expect(search("d4e5f7")).toEqual([]);
    expect(search("d4ef56")).toEqual([]);
  });

  it("forgives one wrong letter", () => {
    expect(search("stripr")).toEqual(["Stripe API Key"]);
  });

  it("forgives one missing letter", () => {
    expect(search("strpe")).toEqual(["Stripe API Key"]);
  });

  it("forgives one extra letter", () => {
    expect(search("strippe")).toEqual(["Stripe API Key"]);
  });

  it("forgives two swapped letters", () => {
    expect(search("stirpe")).toEqual(["Stripe API Key"]);
  });

  it("forgives two typos in a long word", () => {
    expect(search("passwrod")).toEqual(["Database Password"]);
    expect(search("datbaase")).toEqual(["Database Password"]);
  });

  it("does not forgive typos in short words", () => {
    expect(search("kay")).toEqual([]);
    expect(search("key")).toEqual(["Stripe API Key"]);
  });

  it("does not match when the word is too different", () => {
    expect(search("strxxe")).toEqual([]);
    expect(search("passxxxd")).toEqual([]);
  });

  it("matches a typo in the middle of a longer field", () => {
    expect(search("pasword")).toEqual(["Database Password"]);
  });

  it("requires every word to match", () => {
    expect(search("databse pasword")).toEqual(["Database Password"]);
    expect(search("databse stripe")).toEqual([]);
  });

  it("ignores accents in both the search and the item", () => {
    expect(search("cafe")).toEqual(["Café Token"]);
    expect(search("café")).toEqual(["Café Token"]);
  });

  it("searches the extra fields handed to it", () => {
    expect(search("prodution")).toEqual(["Database Password"]);
    expect(search("biling")).toEqual(["Stripe API Key"]);
  });

  it("skips fields that are missing", () => {
    const filter = fuzzySearchFilter<Item>("token", (item) => [item.name, undefined, null]);
    expect(items.filter(filter).map((item) => item.name)).toEqual(["Café Token"]);
  });
});
