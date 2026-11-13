import type { CipherView } from "@bitwarden/sdk-internal";

import { parseRevealField, pickRevealField } from "./lease-reveal-field";

describe("parseRevealField", () => {
  it("accepts the five fields, case-insensitively", () => {
    expect(parseRevealField("TOTP")).toBe("totp");
    expect(parseRevealField("password")).toBe("password");
  });

  it("requires a field and refuses anything else", () => {
    expect(() => parseRevealField(undefined)).toThrow("--field is required");
    expect(() => parseRevealField("item")).toThrow("is not a field");
    expect(() => parseRevealField("all")).toThrow("is not a field");
  });
});

describe("pickRevealField", () => {
  const login = {
    type: 1,
    notes: "n",
    login: { username: "u", password: "p", totp: "seed", uris: [{ uri: "https://a.test" }] },
  } as unknown as CipherView;

  it("returns exactly the requested field", () => {
    expect(pickRevealField(login, "totp")).toBe("seed");
    expect(pickRevealField(login, "uri")).toBe("https://a.test");
  });

  it("says Not a login for login fields of another type, but still returns notes", () => {
    const note = { type: 2, notes: "n" } as unknown as CipherView;
    expect(() => pickRevealField(note, "password")).toThrow("Not a login.");
    expect(pickRevealField(note, "notes")).toBe("n");
  });

  it("refuses an empty field with the bw get wording", () => {
    const empty = { type: 1, login: {} } as unknown as CipherView;
    expect(() => pickRevealField(empty, "username")).toThrow("No username available");
    expect(() => pickRevealField(empty, "uri")).toThrow("No uri available");
    expect(() => pickRevealField(empty, "notes")).toThrow("No notes available");
  });
});
