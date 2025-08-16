import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { DeDuplicateService } from "./de-duplicate.service";

// Minimal stubs (we directly exercise private logic; no need for full implementations)
const cipherServiceStub = { getAllDecrypted: jest.fn() };
const dialogServiceStub = { open: jest.fn() };
const cipherAuthorizationServiceStub = {};

type UriLike = string | { uri?: string; decryptedValue?: string; text?: string } | null | undefined;

function buildCipher({
  id,
  name,
  username,
  password = "p",
  uris = [],
}: {
  id: string;
  name: string;
  username: string;
  password?: string;
  uris?: UriLike[];
}): CipherView {
  const cv = new CipherView();
  (cv as any).id = id;
  (cv as any).name = name;
  (cv as any).login = { username, password, uris } as any;
  return cv;
}

describe("DeDuplicateService core duplicate detection", () => {
  let service: DeDuplicateService;
  const findSets = (ciphers: CipherView[]) =>
    (service as any).findDuplicateSets(ciphers) as { key: string; ciphers: CipherView[] }[];
  const normalize = (s: string) => (service as any).normalizeUri(s) as string;
  const extract = (c: CipherView) => (service as any).extractUriStrings(c) as string[];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeDuplicateService(
      cipherServiceStub as any,
      dialogServiceStub as any,
      cipherAuthorizationServiceStub as any,
    );
  });

  describe("username + URI bucket", () => {
    it("groups items with same username and host (ignores path/query/fragment)", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "user@example.com",
        uris: ["https://example.com/login"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "user@example.com",
        uris: ["https://example.com/login?foo=1#frag"],
      });
      const sets = findSets([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].ciphers.map((c) => c.id).sort()).toEqual(["1", "2"]);
      expect(sets[0].key).toBe("username+uri: user@example.com @ example.com");
    });

    it("groups when only path differs", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://example.com/a"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://example.com/b"],
      });
      const sets = findSets([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("groups when only query differs", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://example.com/path?x=1"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://example.com/path?x=2"],
      });
      const sets = findSets([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("groups when only fragment differs", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://example.com/path#one"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://example.com/path#two"],
      });
      const sets = findSets([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("groups when only scheme differs (http vs https)", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["http://example.com/login"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://example.com/login"],
      });
      const sets = findSets([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("groups when host case and trailing slash differ", () => {
      const c1 = buildCipher({ id: "1", name: "A", username: "u", uris: ["HTTPS://EXAMPLE.COM/"] });
      const c2 = buildCipher({ id: "2", name: "B", username: "u", uris: ["https://example.com"] });
      const sets = findSets([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("does NOT group when hosts differ even with matching username", () => {
      const c1 = buildCipher({
        id: "1",
        name: "X",
        username: "u",
        uris: ["https://a.example.com"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "Y",
        username: "u",
        uris: ["https://b.example.com"],
      });
      expect(findSets([c1, c2])).toHaveLength(0);
    });

    it("does NOT group when usernames differ even if host matches", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "alice",
        uris: ["https://service.test"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "bob",
        uris: ["http://service.test/"],
      });
      expect(findSets([c1, c2])).toHaveLength(0);
    });

    it("multiple URIs per cipher can map to multiple hosts, but identical membership collapses to one set", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://a.test", "https://b.test/"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["http://A.test/", "http://b.test"],
      });
      const sets = findSets([c1, c2]);
      expect(sets).toHaveLength(1);
      const key = sets[0].key;
      expect(["username+uri: u @ a.test", "username+uri: u @ b.test"]).toContain(key);
      expect(sets[0].ciphers.map((c) => c.id).sort()).toEqual(["1", "2"]);
    });

    it("creates a single set when 3+ ciphers share same username+host", () => {
      const cs = [1, 2, 3].map((i) =>
        buildCipher({
          id: String(i),
          name: "N" + i,
          username: "u",
          uris: ["example.org/path" + i],
        }),
      );
      const sets = findSets(cs);
      expect(sets).toHaveLength(1);
      expect(sets[0].ciphers).toHaveLength(3);
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2", "3"]));
      expect(sets[0].key).toBe("username+uri: u @ example.org");
    });

    it("ignores ciphers without username or without valid URIs", () => {
      const good1 = buildCipher({ id: "1", name: "A", username: "u", uris: ["https://good.test"] });
      const badNoUsername = buildCipher({ id: "2", name: "B", username: "", uris: ["good.test"] });
      const badWhitespaceUsername = buildCipher({
        id: "3",
        name: "C",
        username: "   ",
        uris: ["good.test"],
      });
      const badNoUris = buildCipher({ id: "4", name: "D", username: "u", uris: [] });
      const sets = findSets([good1, badNoUsername, badWhitespaceUsername, badNoUris]);
      expect(sets).toHaveLength(0); // only one valid item -> no duplicate set
    });

    it("does not create a duplicate set when a single cipher has multiple URIs that normalize to the same host", () => {
      const c1 = buildCipher({
        id: "1",
        name: "!_TEST",
        username: "tester",
        uris: [
          "forum.test.domain.org",
          "forum.test.domain.org/login",
          "HTTP://FORUM.TEST.DOMAIN.ORG",
        ],
      });
      // Only one cipher overall; previously this could push the same cipher twice into the same bucket.
      const sets = findSets([c1]);
      expect(sets).toHaveLength(0);
    });

    it("with multiple items, a cipher that lists the same host multiple times appears only once in that host's grouping", () => {
      const c1 = buildCipher({
        id: "1",
        name: "!_TEST",
        username: "tester",
        uris: ["test.domain.org", "forum.test.domain.org", "forum.test.domain.org/login"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "2_TEST",
        username: "tester",
        uris: ["test.domain.org"],
      });
      const c3 = buildCipher({
        id: "3",
        name: "3_TEST",
        username: "tester",
        uris: ["forum.test.domain.org"],
      });

      const sets = findSets([c1, c2, c3]);
      const setsByKey = new Map(sets.map((s) => [s.key, s]));

      const forumKey = "username+uri: tester @ forum.test.domain.org";
      const testKey = "username+uri: tester @ test.domain.org";

      expect(setsByKey.has(forumKey)).toBe(true);
      expect(setsByKey.has(testKey)).toBe(true);

      const forumSet = setsByKey.get(forumKey)!;
      const testSet = setsByKey.get(testKey)!;

      // Each set should contain each cipher at most once
      expect(forumSet.ciphers.map((c) => c.id).sort()).toEqual(["1", "3"]);
      expect(testSet.ciphers.map((c) => c.id).sort()).toEqual(["1", "2"]);
    });
  });

  describe("username + name bucket", () => {
    it("groups on username+name when at least two ciphers match and username+uri doesn't apply", () => {
      const c1 = buildCipher({
        id: "1",
        name: "Shared Name",
        username: "u",
        uris: ["https://one.example"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "Shared Name",
        username: "u",
        uris: ["https://two.example"],
      });
      // Hosts differ so no URI duplicate; should produce exactly one name-based set
      const sets = findSets([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+name: u & Shared Name");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("groups when names differ only by case (case-insensitive)", () => {
      const c1 = buildCipher({ id: "1", name: "Login", username: "u", uris: ["a.example"] });
      const c2 = buildCipher({ id: "2", name: "login", username: "u", uris: ["b.example"] });
      const sets = findSets([c1, c2]);
      const nameSet = sets.find((s) => s.key.startsWith("username+name: u &"));
      expect(nameSet).toBeDefined();
      expect(new Set(nameSet!.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("groups when names match after trimming outer whitespace", () => {
      const c1 = buildCipher({ id: "1", name: "  Space  ", username: "u", uris: ["one.example"] });
      const c2 = buildCipher({ id: "2", name: "Space", username: "u", uris: ["two.example"] });
      const sets = findSets([c1, c2]);
      const match = sets.find((s) => s.key === "username+name: u & Space");
      expect(match).toBeDefined();
      expect(new Set(match!.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("groups when internal whitespace differs (whitespace-insensitive)", () => {
      const c1 = buildCipher({ id: "1", name: "My  Site", username: "u", uris: ["x.example"] });
      const c2 = buildCipher({ id: "2", name: "My\tSite", username: "u", uris: ["y.example"] });
      const c3 = buildCipher({ id: "3", name: "My Site", username: "u", uris: ["z.example"] });
      const sets = findSets([c1, c2, c3]);
      const nameSet = sets.find((s) => s.key.startsWith("username+name: u &"));
      expect(nameSet).toBeDefined();
      expect(new Set(nameSet!.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2", "3"]));
    });

    it("does NOT group when usernames differ only by case (username case sensitive)", () => {
      const c1 = buildCipher({ id: "1", name: "Exact", username: "User", uris: ["site1.example"] });
      const c2 = buildCipher({ id: "2", name: "Exact", username: "user", uris: ["site2.example"] });
      const sets = findSets([c1, c2]);
      expect(sets.find((s) => s.key.startsWith("username+name:"))).toBeUndefined();
    });

    it("groups when usernames match after trimming outer whitespace", () => {
      const c1 = buildCipher({ id: "1", name: "Label", username: " user ", uris: ["h1.example"] });
      const c2 = buildCipher({ id: "2", name: "Label", username: "user", uris: ["h2.example"] });
      const sets = findSets([c1, c2]);
      const match = sets.find((s) => s.key === "username+name: user & Label");
      expect(match).toBeDefined();
      expect(new Set(match!.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("creates a single name bucket for 3+ matching ciphers", () => {
      const cs = [1, 2, 3].map((i) =>
        buildCipher({
          id: String(i),
          name: "Cluster",
          username: "u",
          uris: ["host" + i + ".example"],
        }),
      );
      const sets = findSets(cs);
      const nameSet = sets.filter((s) => s.key === "username+name: u & Cluster");
      expect(nameSet).toHaveLength(1);
      expect(nameSet[0].ciphers).toHaveLength(3);
    });

    it("includes ciphers lacking any URIs in name bucket grouping", () => {
      const c1 = buildCipher({ id: "1", name: "Shared", username: "u", uris: [] });
      const c2 = buildCipher({ id: "2", name: "Shared", username: "u", uris: ["alpha.example"] });
      const sets = findSets([c1, c2]);
      const match = sets.find((s) => s.key === "username+name: u & Shared");
      expect(match).toBeDefined();
      expect(new Set(match!.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("can produce both URI and name duplicate sets (distinct keys, overlapping ciphers)", () => {
      const c1 = buildCipher({ id: "1", name: "Same", username: "u", uris: ["a.example"] });
      const c2 = buildCipher({ id: "2", name: "Same", username: "u", uris: ["A.EXAMPLE/path"] });
      const c3 = buildCipher({ id: "3", name: "Same", username: "u", uris: ["other.example"] });
      const sets = findSets([c1, c2, c3]);
      const keys = sets.map((s) => s.key).sort();
      expect(keys).toEqual(["username+name: u & Same", "username+uri: u @ a.example"]);
      const uriSet = sets.find((s) => s.key === "username+uri: u @ a.example")!;
      const nameSet = sets.find((s) => s.key === "username+name: u & Same")!;
      expect(new Set(uriSet.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
      expect(new Set(nameSet.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2", "3"]));
    });

    it("when URI and name sets have identical cipher IDs, only the URI set is kept", () => {
      const c1 = buildCipher({ id: "1", name: "Same", username: "u", uris: ["a.example"] });
      const c2 = buildCipher({ id: "2", name: "Same", username: "u", uris: ["A.EXAMPLE"] });
      const sets = findSets([c1, c2]);
      // both groupings would include [1,2], but the implementation prefers the URI set
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ a.example");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("does not create name bucket if only one cipher present", () => {
      const c1 = buildCipher({ id: "1", name: "Solo", username: "u", uris: ["solo.example"] });
      expect(findSets([c1])).toHaveLength(0);
    });

    it("requires non-empty trimmed username and name", () => {
      const good = buildCipher({ id: "1", name: "Name", username: "u", uris: ["x.test"] });
      const noName = buildCipher({ id: "2", name: "", username: "u", uris: ["y.test"] });
      const blankName = buildCipher({ id: "3", name: "   ", username: "u", uris: ["z.test"] });
      const noUsername = buildCipher({ id: "4", name: "Name", username: "", uris: ["z.test"] });
      expect(findSets([good, noName, blankName, noUsername])).toHaveLength(0);
    });
  });

  describe("URI extraction", () => {
    it("extracts from string and object variants (uri, decryptedValue, text) and ignores empty/missing", () => {
      const c = buildCipher({
        id: "1",
        name: "X",
        username: "u",
        uris: [
          "https://one.test/path",
          { uri: "two.test" },
          { decryptedValue: "http://three.test/a" },
          { text: "FOUR.test" },
          { uri: "" },
          null,
          undefined,
          {},
        ],
      });
      const values = extract(c).sort();
      expect(values).toEqual(
        ["FOUR.test", "http://three.test/a", "https://one.test/path", "two.test"].sort(),
      );
    });

    it("returns empty array when login.uris is not an array", () => {
      const c = buildCipher({ id: "1", name: "X", username: "u", uris: [] });
      // Force a non-array value
      (c as any).login.uris = "not-an-array" as any;
      expect(extract(c)).toEqual([]);
    });
  });

  describe("normalizeUri", () => {
    it("adds https scheme when missing", () => {
      expect(normalize("Example.com/login?x=1")).toBe("example.com");
    });

    it("lowercases host and strips path/query/fragment", () => {
      expect(normalize("HTTP://EXAMPLE.COM/Path/To?x=1#hash")).toBe("example.com");
    });

    it("strips default/any port", () => {
      expect(normalize("https://example.com:443/foo")).toBe("example.com");
      expect(normalize("https://example.com:8443/foo")).toBe("example.com");
    });

    it("handles IPv4", () => {
      expect(normalize("http://192.168.0.1/login")).toBe("192.168.0.1");
    });

    it("handles IPv6 with brackets and port", () => {
      expect(normalize("http://[2001:db8::1]:8080/path")).toBe("2001:db8::1");
    });

    it("removes trailing dot", () => {
      expect(normalize("https://example.com./x")).toBe("example.com");
    });

    it("removes userinfo", () => {
      expect(normalize("https://user:pass@example.com/path")).toBe("example.com");
    });

    it("returns empty string for blank input", () => {
      expect(normalize("")).toBe("");
      expect(normalize("   ")).toBe("");
    });

    it("supports internationalized domains via punycode", () => {
      // The URL parser returns punycoded hostname for IDN.
      const host = normalize("https://münich.example/secure");
      expect(host).toMatch(/^xn--mnich-kva\.example$/); // Punycode of münich.example
    });

    describe("fallback regex path (forced URL parse failure)", () => {
      let originalURL: any;
      beforeEach(() => {
        originalURL = (global as any).URL;
        (global as any).URL = class FailingURL {
          constructor(_s: string) {
            throw new Error("forced parse failure");
          }
        } as any;
      });
      afterEach(() => {
        (global as any).URL = originalURL;
      });

      it("extracts host + lowercases + strips path/query/fragment", () => {
        expect(normalize("HTTPS://Example.COM/Some/Path?x=1#frag")).toBe("example.com");
      });

      it("strips userinfo and port", () => {
        expect(normalize("custom+scheme://user:pass@Sub.Domain.Example.COM:8080/resource")).toBe(
          "sub.domain.example.com",
        );
      });

      it("handles IPv6 with brackets and port", () => {
        expect(normalize("ftp://[2001:db8::2]:8042/over/there")).toBe("2001:db8::2");
      });

      it("removes trailing dot", () => {
        expect(normalize("https://example.com./path")).toBe("example.com");
      });

      it("returns empty string when authority missing", () => {
        expect(normalize("https://")).toBe("");
      });
    });
  });

  describe("name-only bucket (no username)", () => {
    it("groups items without username by canonicalized name (case/whitespace-insensitive)", () => {
      const c1 = buildCipher({ id: "1", name: "My App", username: "", uris: [] });
      const c2 = buildCipher({ id: "2", name: "  my\tapp  ", username: "", uris: [] });
      const sets = findSets([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+name:  & My App");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("does not mix username-present with username-absent, even if names match", () => {
      const noUser = buildCipher({ id: "1", name: "Same", username: "", uris: [] });
      const u1 = buildCipher({ id: "2", name: "Same", username: "u", uris: [] });
      const u2 = buildCipher({ id: "3", name: "Same", username: "u", uris: [] });
      const sets = findSets([noUser, u1, u2]);
      // Should only produce the username+name set for user "u"
      const keys = sets.map((s) => s.key).sort();
      expect(keys).toEqual(["username+name: u & Same"]);
      const unameSet = sets[0];
      expect(new Set(unameSet.ciphers.map((c) => c.id))).toEqual(new Set(["2", "3"]));
    });

    it("creates a single name-only bucket for 3+ matching ciphers", () => {
      const cs = [1, 2, 3].map((i) =>
        buildCipher({ id: String(i), name: "Cluster", username: "", uris: [] }),
      );
      const sets = findSets(cs);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+name:  & Cluster");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2", "3"]));
    });

    it("does not create a name-only set for a single item or blank name", () => {
      const solo = buildCipher({ id: "1", name: "Solo", username: "", uris: [] });
      const blank = buildCipher({ id: "2", name: "   ", username: "", uris: [] });
      expect(findSets([solo])).toHaveLength(0);
      expect(findSets([blank])).toHaveLength(0);
    });
  });
});
