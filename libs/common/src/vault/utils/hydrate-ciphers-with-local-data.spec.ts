import { CipherId } from "../../types/guid";
import { LocalData } from "../models/data/local.data";
import { CipherView } from "../models/view/cipher.view";

import { hydrateCiphersWithLocalData } from "./hydrate-ciphers-with-local-data";

function createCipher(id: string, name: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = name;
  return cipher;
}

describe("hydrateCiphersWithLocalData", () => {
  it("attaches localData to ciphers with a matching entry", () => {
    const first = createCipher("first", "First");
    const second = createCipher("second", "Second");
    const localData = {
      ["first" as CipherId]: { lastUsedDate: 200 },
      ["second" as CipherId]: { lastUsedDate: 100 },
    } as Record<CipherId, LocalData>;

    hydrateCiphersWithLocalData([first, second], localData);

    expect(first.localData).toEqual({ lastUsedDate: 200 });
    expect(second.localData).toEqual({ lastUsedDate: 100 });
  });

  it("leaves ciphers without a matching entry untouched", () => {
    const cipher = createCipher("first", "First");
    const localData = {
      ["other" as CipherId]: { lastUsedDate: 200 },
    } as Record<CipherId, LocalData>;

    hydrateCiphersWithLocalData([cipher], localData);

    expect(cipher.localData).toBeUndefined();
  });

  it.each([null, undefined])("is a no-op when localData is %s", (localData) => {
    const cipher = createCipher("first", "First");

    hydrateCiphersWithLocalData([cipher], localData);

    expect(cipher.localData).toBeUndefined();
  });

  it("returns the same array instance for chaining", () => {
    const ciphers = [createCipher("first", "First")];

    expect(hydrateCiphersWithLocalData(ciphers, null)).toBe(ciphers);
  });

  it("skips nullish entries and entries without an id without throwing", () => {
    const valid = createCipher("first", "First");
    const localData = {
      ["first" as CipherId]: { lastUsedDate: 200 },
    } as Record<CipherId, LocalData>;
    // The decrypted list may contain malformed entries; hydration must tolerate them.
    const ciphers = [null, undefined, new CipherView(), valid] as unknown as CipherView[];

    expect(() => hydrateCiphersWithLocalData(ciphers, localData)).not.toThrow();
    expect(valid.localData).toEqual({ lastUsedDate: 200 });
  });

  it("enables last-used ordering that is otherwise lost without localData", () => {
    // Names here are the reverse of last-used order, so a last-used sort must override the name.
    const localData = {
      ["recent" as CipherId]: { lastUsedDate: 2000 },
      ["older" as CipherId]: { lastUsedDate: 1000 },
    } as Record<CipherId, LocalData>;
    const byLastUsedDescending = (a: CipherView, b: CipherView): number => {
      return (b.localData?.lastUsedDate ?? 0) - (a.localData?.lastUsedDate ?? 0);
    };

    // Without hydration both dates are undefined, the comparator ties, and insertion order stands.
    const withoutHydration = [createCipher("older", "Bilbo"), createCipher("recent", "Frodo")].sort(
      byLastUsedDescending,
    );
    expect(withoutHydration.map((cipher) => cipher.name)).toEqual(["Bilbo", "Frodo"]);

    // With hydration the most recently used cipher sorts first regardless of name.
    const withHydration = hydrateCiphersWithLocalData(
      [createCipher("older", "Bilbo"), createCipher("recent", "Frodo")],
      localData,
    ).sort(byLastUsedDescending);
    expect(withHydration.map((cipher) => cipher.name)).toEqual(["Frodo", "Bilbo"]);
  });
});
