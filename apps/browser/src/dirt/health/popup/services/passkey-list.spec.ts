import { PasskeyOpportunity } from "@bitwarden/common/dirt/vault-health/models";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";

import {
  buildPasskeyListRows,
  isFilteringPasskeys,
  matchesPasskeyFilters,
  passkeyComparator,
  passkeyGroupOf,
  PasskeyGroup,
  PasskeyListRow,
  passkeySetUpUrl,
} from "./passkey-list";

function login(
  id: string,
  init: { name?: string; username?: string; uris?: string[]; folderId?: string } = {},
): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = init.name ?? id;
  cipher.type = CipherType.Login;
  cipher.folderId = init.folderId;
  cipher.login.username = init.username;
  cipher.login.uris = (init.uris ?? []).map((uri) => {
    const view = new LoginUriView();
    view.uri = uri;
    return view;
  });
  return cipher;
}

function opportunity(id: string, init: Partial<PasskeyOpportunity> = {}): PasskeyOpportunity {
  return { id, supportsPasskeyLogin: true, supportsPasskeyMfa: false, ...init };
}

function rowsFor(ciphers: CipherView[], opportunities: PasskeyOpportunity[]): PasskeyListRow[] {
  return buildPasskeyListRows(opportunities, new Map(ciphers.map((c) => [c.id, c])));
}

describe("passkeyGroupOf", () => {
  it.each([
    [true, false, PasskeyGroup.Login],
    [true, true, PasskeyGroup.Login],
    [false, true, PasskeyGroup.TwoStep],
  ])("login %s and two-step %s go in %s", (supportsPasskeyLogin, supportsPasskeyMfa, group) => {
    expect(passkeyGroupOf(opportunity("a", { supportsPasskeyLogin, supportsPasskeyMfa }))).toBe(
      group,
    );
  });
});

describe("passkeySetUpUrl", () => {
  it("prefers the site's passkey instructions", () => {
    const cipher = login("a", { uris: ["https://example.com/login"] });

    expect(
      passkeySetUpUrl(opportunity("a", { instructions: "https://example.com/pk" }), cipher),
    ).toBe("https://example.com/pk");
  });

  it("falls back to the login's own site without instructions", () => {
    const cipher = login("a", { uris: ["example.com"] });

    expect(passkeySetUpUrl(opportunity("a"), cipher)).toBe("http://example.com");
  });

  it.each(["javascript:alert(1)", "ftp://example.com"])(
    "never returns a link the popup should not launch (%s)",
    (unsafe) => {
      const cipher = login("a", { uris: [unsafe] });

      expect(passkeySetUpUrl(opportunity("a", { instructions: unsafe }), cipher)).toBeUndefined();
    },
  );

  it("is undefined with neither instructions nor a site", () => {
    expect(passkeySetUpUrl(opportunity("a"), login("a"))).toBeUndefined();
  });
});

describe("buildPasskeyListRows", () => {
  it("joins opportunities to their logins and drops any whose login is gone", () => {
    const rows = rowsFor([login("a")], [opportunity("a"), opportunity("deleted")]);

    expect(rows.map((row) => row.id)).toEqual(["a"]);
  });

  it("shows the username, then the site's hostname, as the second line", () => {
    const rows = rowsFor(
      [
        login("a", { username: "kim@example.com", uris: ["https://a.example"] }),
        login("b", { uris: ["https://www.b.example/login"] }),
        login("c"),
      ],
      [opportunity("a"), opportunity("b"), opportunity("c")],
    );

    expect(rows.map((row) => row.secondary)).toEqual([
      "kim@example.com",
      "www.b.example",
      undefined,
    ]);
  });

  it("puts each row in one group and keeps its folder", () => {
    const [row] = rowsFor(
      [login("a", { folderId: "work" })],
      [opportunity("a", { supportsPasskeyLogin: false, supportsPasskeyMfa: true })],
    );

    expect(row.group).toBe(PasskeyGroup.TwoStep);
    expect(row.folderId).toBe("work");
  });
});

describe("matchesPasskeyFilters", () => {
  const [row] = rowsFor(
    [
      login("a", {
        name: "Dropbox",
        username: "frank@example.com",
        uris: ["https://dropbox.com"],
        folderId: "work",
      }),
    ],
    [opportunity("a")],
  );

  it.each(["drop", "FRANK", "dropbox.com"])("matches a search for %s", (search) => {
    expect(matchesPasskeyFilters(row, { search })).toBe(true);
  });

  it("does not match a search for something else", () => {
    expect(matchesPasskeyFilters(row, { search: "netflix" })).toBe(false);
  });

  it("matches a chosen folder only", () => {
    expect(matchesPasskeyFilters(row, { folder: ["work"] })).toBe(true);
    expect(matchesPasskeyFilters(row, { folder: ["home"] })).toBe(false);
  });

  it("knows when the list is narrowed", () => {
    expect(isFilteringPasskeys({})).toBe(false);
    expect(isFilteringPasskeys({ search: "  " })).toBe(false);
    expect(isFilteringPasskeys({ search: "a" })).toBe(true);
    expect(isFilteringPasskeys({ folder: ["work"] })).toBe(true);
  });
});

describe("passkeyComparator", () => {
  it("sorts by name A to Z regardless of case, then by the second line", () => {
    const rows = rowsFor(
      [
        login("1", { name: "dropbox", username: "z" }),
        login("2", { name: "Amazon" }),
        login("3", { name: "Dropbox", username: "a" }),
      ],
      [opportunity("1"), opportunity("2"), opportunity("3")],
    );

    const sorted = [...rows].sort(
      passkeyComparator(new Intl.Collator("en", { sensitivity: "base" })),
    );

    expect(sorted.map((row) => row.id)).toEqual(["2", "3", "1"]);
  });
});
