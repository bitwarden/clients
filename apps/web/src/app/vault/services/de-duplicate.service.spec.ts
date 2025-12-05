import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { DeDuplicateService } from "./de-duplicate.service";

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
  const findSetsHostname = (ciphers: CipherView[]) =>
    (service as any).findDuplicateSets(ciphers, "Hostname") as {
      key: string;
      ciphers: CipherView[];
    }[];
  const findSetsBase = (ciphers: CipherView[]) =>
    (service as any).findDuplicateSets(ciphers, "Base") as {
      key: string;
      ciphers: CipherView[];
    }[];
  const findSetsHost = (ciphers: CipherView[]) =>
    (service as any).findDuplicateSets(ciphers, "Host") as {
      key: string;
      ciphers: CipherView[];
    }[];
  const findSetsExact = (ciphers: CipherView[]) =>
    (service as any).findDuplicateSets(ciphers, "Exact") as {
      key: string;
      ciphers: CipherView[];
    }[];
  const findSetsDefault = (ciphers: CipherView[]) =>
    (service as any).findDuplicateSets(ciphers) as {
      key: string;
      ciphers: CipherView[];
    }[];
  // Legacy normalizeUri tests now validate Hostname strategy normalization.
  // Return the single Hostname key for a given input, or empty string when none.
  const normalize = (s: string) => {
    const set = (service as any).getUriKeysForStrategy([s], "Hostname") as Set<string>;
    const first = Array.from(set)[0];
    return first ?? "";
  };
  const extract = (c: CipherView) => (service as any).extractUriStrings(c) as string[];
  const keysFor = (uris: string[], strat: string) =>
    Array.from((service as any).getUriKeysForStrategy(uris, strat)).sort();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeDuplicateService(
      cipherServiceStub as any,
      dialogServiceStub as any,
      cipherAuthorizationServiceStub as any,
    );
  });

  describe("matching strategy default to Base", () => {
    it("uses Base when not specified: subdomains group by registrable domain", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://a.example.com"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://b.example.com/login"],
      });
      const sets = findSetsDefault([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });
  });

  describe("username + URI bucket (Hostname strategy)", () => {
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
      const sets = findSetsHostname([c1, c2]);
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
      const sets = findSetsHostname([c1, c2]);
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
      const sets = findSetsHostname([c1, c2]);
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
      const sets = findSetsHostname([c1, c2]);
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
      const sets = findSetsHostname([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("groups when host case and trailing slash differ", () => {
      const c1 = buildCipher({ id: "1", name: "A", username: "u", uris: ["HTTPS://EXAMPLE.COM/"] });
      const c2 = buildCipher({ id: "2", name: "B", username: "u", uris: ["https://example.com"] });
      const sets = findSetsHostname([c1, c2]);
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
      expect(findSetsHostname([c1, c2])).toHaveLength(0);
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
      expect(findSetsHostname([c1, c2])).toHaveLength(0);
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
      const sets = findSetsHostname([c1, c2]);
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
      const sets = findSetsHostname(cs);
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
      const sets = findSetsHostname([good1, badNoUsername, badWhitespaceUsername, badNoUris]);
      expect(sets).toHaveLength(0);
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
      const sets = findSetsHostname([c1]);
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

      const sets = findSetsHostname([c1, c2, c3]);
      const setsByKey = new Map(sets.map((s) => [s.key, s]));

      const forumKey = "username+uri: tester @ forum.test.domain.org";
      const testKey = "username+uri: tester @ test.domain.org";

      expect(setsByKey.has(forumKey)).toBe(true);
      expect(setsByKey.has(testKey)).toBe(true);

      const forumSet = setsByKey.get(forumKey)!;
      const testSet = setsByKey.get(testKey)!;

      expect(forumSet.ciphers.map((c) => c.id).sort()).toEqual(["1", "3"]);
      expect(testSet.ciphers.map((c) => c.id).sort()).toEqual(["1", "2"]);
    });

    it("groups androidapp variants by package id for same username", () => {
      const c1 = buildCipher({
        id: "1",
        name: "App1",
        username: "u",
        uris: ["androidapp://com.pkg/path"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "App2",
        username: "u",
        uris: ["androidapp:com.pkg?x=1"],
      });
      const sets = findSetsHostname([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ com.pkg");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("IPv6 with different ports: still groups (port ignored)", () => {
      const c1 = buildCipher({
        id: "1",
        name: "V6a",
        username: "u",
        uris: ["http://[2001:db8::1]:8080/a"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "V6b",
        username: "u",
        uris: ["http://[2001:db8::1]:8081/b"],
      });
      const sets = findSetsHostname([c1, c2]);
      expect(sets).toHaveLength(1);
    });
  });

  describe("username + URI bucket (Base strategy)", () => {
    it("groups items with same username by registrable domain (ignores subdomain/path/query/fragment)", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "user@example.com",
        uris: ["https://a.example.com/login"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "user@example.com",
        uris: ["https://b.example.com/login?foo=1#frag"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].ciphers.map((c) => c.id).sort()).toEqual(["1", "2"]);
      expect(sets[0].key).toBe("username+uri: user@example.com @ example.com");
    });

    it("groups when only path differs", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://a.example.com/a"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://a.example.com/b"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("groups when only query differs", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://a.example.com/path?x=1"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://b.example.com/path?x=2"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("groups when only fragment differs", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://a.example.com/path#one"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://b.example.com/path#two"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("groups when only scheme differs (http vs https)", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["http://a.example.com/login"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://b.example.com/login"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("groups when host case and trailing slash differ", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["HTTPS://A.EXAMPLE.COM/"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://a.example.com"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("does NOT group when usernames differ even if base matches", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "alice",
        uris: ["https://a.example.com"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "bob",
        uris: ["https://b.example.com/"],
      });
      expect(findSetsBase([c1, c2])).toHaveLength(0);
    });

    it("multiple URIs per cipher can map to multiple bases, but identical membership collapses to one set", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://a.example.com", "https://b.example.net/"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["http://A.example.com/", "http://b.example.net"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
      const key = sets[0].key;
      expect(["username+uri: u @ example.com", "username+uri: u @ example.net"]).toContain(key);
      expect(sets[0].ciphers.map((c) => c.id).sort()).toEqual(["1", "2"]);
    });

    it("creates a single set when 3+ ciphers share same username+base", () => {
      const cs = [1, 2, 3].map((i) =>
        buildCipher({
          id: String(i),
          name: "N" + i,
          username: "u",
          uris: [
            i === 1 ? "a.example.org/path" : i === 2 ? "b.example.org" : "https://example.org/",
          ],
        }),
      );
      const sets = findSetsBase(cs);
      expect(sets).toHaveLength(1);
      expect(sets[0].ciphers).toHaveLength(3);
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2", "3"]));
      expect(sets[0].key).toBe("username+uri: u @ example.org");
    });

    it("ignores ciphers without username or without valid URIs", () => {
      const good1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://good.example"],
      });
      const badNoUsername = buildCipher({
        id: "2",
        name: "B",
        username: "",
        uris: ["good.example"],
      });
      const badWhitespaceUsername = buildCipher({
        id: "3",
        name: "C",
        username: "   ",
        uris: ["good.example"],
      });
      const badNoUris = buildCipher({ id: "4", name: "D", username: "u", uris: [] });
      const sets = findSetsBase([good1, badNoUsername, badWhitespaceUsername, badNoUris]);
      expect(sets).toHaveLength(0);
    });

    it("does not create a duplicate set when a single cipher has multiple URIs that normalize to the same base", () => {
      const c1 = buildCipher({
        id: "1",
        name: "!_TEST",
        username: "tester",
        uris: ["a.example.org", "a.example.org/login", "HTTP://A.EXAMPLE.ORG"],
      });
      const sets = findSetsBase([c1]);
      expect(sets).toHaveLength(0);
    });

    it("with multiple items, a cipher that lists the same base multiple times appears only once in that base's grouping", () => {
      const c1 = buildCipher({
        id: "1",
        name: "!_TEST",
        username: "tester",
        uris: ["a.example.org", "b.a.example.org", "b.a.example.org/login"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "2_TEST",
        username: "tester",
        uris: ["example.org"],
      });
      const c3 = buildCipher({
        id: "3",
        name: "3_TEST",
        username: "tester",
        uris: ["forum.example.org"],
      });

      const sets = findSetsBase([c1, c2, c3]);
      const setsByKey = new Map(sets.map((s) => [s.key, s]));

      const baseKey = "username+uri: tester @ example.org";
      expect(setsByKey.has(baseKey)).toBe(true);
      const baseSet = setsByKey.get(baseKey)!;
      expect(baseSet.ciphers.map((c) => c.id).sort()).toEqual(["1", "2", "3"]);
    });

    it("groups androidapp variants by package id for same username", () => {
      const c1 = buildCipher({
        id: "1",
        name: "App1",
        username: "u",
        uris: ["androidapp://com.pkg/path"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "App2",
        username: "u",
        uris: ["androidapp:com.pkg?x=1"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ com.pkg");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("IPv6 with different ports: still groups (port ignored)", () => {
      const c1 = buildCipher({
        id: "1",
        name: "V6a",
        username: "u",
        uris: ["http://[2001:db8::1]:8080/a"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "V6b",
        username: "u",
        uris: ["http://[2001:db8::1]:8081/b"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
    });

    it("PSL: subdomains under example.co.uk group to example.co.uk", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://a.b.example.co.uk/login"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["http://example.co.uk/"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.co.uk");
    });

    it("PSL: different owners on github.io do NOT group (user1 vs user2)", () => {
      const c1 = buildCipher({
        id: "1",
        name: "Gh1",
        username: "u",
        uris: ["https://user1.github.io/"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "Gh2",
        username: "u",
        uris: ["https://user2.github.io/blog"],
      });
      expect(findSetsBase([c1, c2])).toHaveLength(0);
    });

    it("PSL: subdomains under the same user.github.io DO group", () => {
      const c1 = buildCipher({
        id: "1",
        name: "Gh",
        username: "u",
        uris: ["https://a.user.github.io/"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "Gh",
        username: "u",
        uris: ["https://b.user.github.io/docs"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ user.github.io");
    });

    it("PSL: different apps on appspot.com do NOT group; same app subdomains DO group", () => {
      const a1 = buildCipher({
        id: "1",
        name: "AppA",
        username: "u",
        uris: ["http://foo.appspot.com"],
      });
      const a2 = buildCipher({
        id: "2",
        name: "AppB",
        username: "u",
        uris: ["https://bar.appspot.com/login"],
      });
      expect(findSetsBase([a1, a2])).toHaveLength(0);

      const s1 = buildCipher({
        id: "3",
        name: "AppA",
        username: "u",
        uris: ["http://a.foo.appspot.com/x"],
      });
      const s2 = buildCipher({
        id: "4",
        name: "AppA",
        username: "u",
        uris: ["https://b.foo.appspot.com/y"],
      });
      const subSets = findSetsBase([s1, s2]);
      expect(subSets).toHaveLength(1);
      expect(subSets[0].key).toBe("username+uri: u @ foo.appspot.com");
    });

    it("PSL miss: internal/private zones use full host (no last-two-label collapse)", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://a.b.internal/"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://c.b.internal/"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(0);
    });

    it("PSL miss: cluster.local style names remain distinct", () => {
      const c1 = buildCipher({
        id: "1",
        name: "G",
        username: "u",
        uris: ["http://service-a.monitoring.svc.cluster.local/login"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "P",
        username: "u",
        uris: ["http://service-b.monitoring.svc.cluster.local/"],
      });
      const sets = findSetsBase([c1, c2]);
      expect(sets).toHaveLength(0);
    });
  });

  describe("username + URI bucket (Host strategy)", () => {
    it("groups when host matches regardless of path/query/fragment/scheme", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["http://example.com/a?x=1#f"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://example.com/b"],
      });
      const sets = findSetsHost([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com");
    });

    it("does NOT group when ports differ", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://example.com:443/login"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://example.com:8443/login"],
      });
      const sets = findSetsHost([c1, c2]);
      expect(sets).toHaveLength(0);
    });

    it("does NOT group when usernames differ even if host:port matches", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "alice",
        uris: ["https://example.com:8080/"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "bob",
        uris: ["http://example.com:8080/"],
      });
      expect(findSetsHost([c1, c2])).toHaveLength(0);
    });

    it("single cipher with multiple identical host:port URIs does not produce a set", () => {
      const c1 = buildCipher({
        id: "1",
        name: "X",
        username: "u",
        uris: ["http://example.com:8080/x", "HTTP://EXAMPLE.COM:8080/y"],
      });
      expect(findSetsHost([c1])).toHaveLength(0);
    });

    it("multiple items: repeated host:port per cipher only included once in that group's membership", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["example.com:8080", "http://example.com:8080/x"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://example.com:8080/"],
      });
      const sets = findSetsHost([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ example.com:8080");
      expect(sets[0].ciphers.map((c) => c.id).sort()).toEqual(["1", "2"]);
    });

    it("androidapp variants group by package id", () => {
      const c1 = buildCipher({
        id: "1",
        name: "App1",
        username: "u",
        uris: ["androidapp://com.pkg/x"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "App2",
        username: "u",
        uris: ["androidapp:com.pkg?y=1"],
      });
      const sets = findSetsHost([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ com.pkg");
    });

    it("IPv6 with different ports do NOT group", () => {
      const c1 = buildCipher({
        id: "1",
        name: "V6a",
        username: "u",
        uris: ["http://[2001:db8::1]:8080/a"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "V6b",
        username: "u",
        uris: ["http://[2001:db8::1]:8081/b"],
      });
      expect(findSetsHost([c1, c2])).toHaveLength(0);
    });
  });

  describe("username + URI bucket (Exact strategy)", () => {
    it("requires exact normalized URL match (path/query/fragment included)", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["HTTPS://EXAMPLE.com/A/B?X=1#Frag"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://example.com/a/b?x=1#frag"],
      });
      const sets = findSetsExact([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ https://example.com/a/b?x=1#frag");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("does NOT group when query differs", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://ex.com/a?x=1#y"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://ex.com/a?x=2#y"],
      });
      expect(findSetsExact([c1, c2])).toHaveLength(0);
    });

    it("does NOT group when fragment differs", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://ex.com/a?x=1#y"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "u",
        uris: ["https://ex.com/a?x=1#z"],
      });
      expect(findSetsExact([c1, c2])).toHaveLength(0);
    });

    it("does NOT group when scheme differs", () => {
      const c1 = buildCipher({ id: "1", name: "A", username: "u", uris: ["http://example.com/a"] });
      const c2 = buildCipher({
        id: "2",
        name: "T",
        username: "u",
        uris: ["https://example.com/a"],
      });
      expect(findSetsExact([c1, c2])).toHaveLength(0);
    });

    it("does NOT group when ports differ", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "u",
        uris: ["https://example.com:443/a"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "Q",
        username: "u",
        uris: ["https://example.com:8443/a"],
      });
      expect(findSetsExact([c1, c2])).toHaveLength(0);
    });

    it("does NOT group when usernames differ even if URL matches", () => {
      const c1 = buildCipher({
        id: "1",
        name: "A",
        username: "alice",
        uris: ["https://example.com/a"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "B",
        username: "bob",
        uris: ["https://example.com/a"],
      });
      expect(findSetsExact([c1, c2])).toHaveLength(0);
    });

    it("single cipher with multiple identical URLs does not produce a set", () => {
      const c1 = buildCipher({
        id: "1",
        name: "X",
        username: "u",
        uris: ["HTTPS://EXAMPLE.com/A?X=1#F", "https://example.com/a?x=1#f"],
      });
      expect(findSetsExact([c1])).toHaveLength(0);
    });

    it("androidapp variants group by package id (normalized to androidapp:pkg)", () => {
      const c1 = buildCipher({
        id: "1",
        name: "App1",
        username: "u",
        uris: ["androidapp://com.pkg/path"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "App2",
        username: "u",
        uris: ["androidapp:COM.PKG?x=1"],
      });
      const sets = findSetsExact([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key.endsWith("@ androidapp:com.pkg")).toBe(true);
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("IPv6 with different ports do NOT group", () => {
      const c1 = buildCipher({
        id: "1",
        name: "V6a",
        username: "u",
        uris: ["http://[2001:db8::1]:8080/a#f"],
      });
      const c2 = buildCipher({
        id: "2",
        name: "V6b",
        username: "u",
        uris: ["http://[2001:db8::1]:8081/a#f"],
      });
      expect(findSetsExact([c1, c2])).toHaveLength(0);
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
      const sets = findSetsHostname([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+name: u & Shared Name");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("groups when names differ only by case (case-insensitive)", () => {
      const c1 = buildCipher({ id: "1", name: "Login", username: "u", uris: ["a.example"] });
      const c2 = buildCipher({ id: "2", name: "login", username: "u", uris: ["b.example"] });
      const sets = findSetsHostname([c1, c2]);
      const nameSet = sets.find((s) => s.key.startsWith("username+name: u &"));
      expect(nameSet).toBeDefined();
      expect(new Set(nameSet!.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("groups when names match after trimming outer whitespace", () => {
      const c1 = buildCipher({ id: "1", name: "  Space  ", username: "u", uris: ["one.example"] });
      const c2 = buildCipher({ id: "2", name: "Space", username: "u", uris: ["two.example"] });
      const sets = findSetsHostname([c1, c2]);
      const match = sets.find((s) => s.key === "username+name: u & Space");
      expect(match).toBeDefined();
      expect(new Set(match!.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("groups when internal whitespace differs (whitespace-insensitive)", () => {
      const c1 = buildCipher({ id: "1", name: "My  Site", username: "u", uris: ["x.example"] });
      const c2 = buildCipher({ id: "2", name: "My\tSite", username: "u", uris: ["y.example"] });
      const c3 = buildCipher({ id: "3", name: "My Site", username: "u", uris: ["z.example"] });
      const sets = findSetsHostname([c1, c2, c3]);
      const nameSet = sets.find((s) => s.key.startsWith("username+name: u &"));
      expect(nameSet).toBeDefined();
      expect(new Set(nameSet!.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2", "3"]));
    });

    it("does NOT group when usernames differ only by case (username case sensitive)", () => {
      const c1 = buildCipher({ id: "1", name: "Exact", username: "User", uris: ["site1.example"] });
      const c2 = buildCipher({ id: "2", name: "Exact", username: "user", uris: ["site2.example"] });
      const sets = findSetsHostname([c1, c2]);
      expect(sets.find((s) => s.key.startsWith("username+name:"))).toBeUndefined();
    });

    it("groups when usernames match after trimming outer whitespace", () => {
      const c1 = buildCipher({ id: "1", name: "Label", username: " user ", uris: ["h1.example"] });
      const c2 = buildCipher({ id: "2", name: "Label", username: "user", uris: ["h2.example"] });
      const sets = findSetsHostname([c1, c2]);
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
      const sets = findSetsHostname(cs);
      const nameSet = sets.filter((s) => s.key === "username+name: u & Cluster");
      expect(nameSet).toHaveLength(1);
      expect(nameSet[0].ciphers).toHaveLength(3);
    });

    it("includes ciphers lacking any URIs in name bucket grouping", () => {
      const c1 = buildCipher({ id: "1", name: "Shared", username: "u", uris: [] });
      const c2 = buildCipher({ id: "2", name: "Shared", username: "u", uris: ["alpha.example"] });
      const sets = findSetsHostname([c1, c2]);
      const match = sets.find((s) => s.key === "username+name: u & Shared");
      expect(match).toBeDefined();
      expect(new Set(match!.ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("can produce both URI and name duplicate sets (distinct keys, overlapping ciphers)", () => {
      const c1 = buildCipher({ id: "1", name: "Same", username: "u", uris: ["a.example"] });
      const c2 = buildCipher({ id: "2", name: "Same", username: "u", uris: ["A.EXAMPLE/path"] });
      const c3 = buildCipher({ id: "3", name: "Same", username: "u", uris: ["other.example"] });
      const sets = findSetsHostname([c1, c2, c3]);
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
      const sets = findSetsHostname([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+uri: u @ a.example");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("does not create name bucket if only one cipher present", () => {
      const c1 = buildCipher({ id: "1", name: "Solo", username: "u", uris: ["solo.example"] });
      expect(findSetsHostname([c1])).toHaveLength(0);
    });

    it("requires non-empty trimmed username and name", () => {
      const good = buildCipher({ id: "1", name: "Name", username: "u", uris: ["x.test"] });
      const noName = buildCipher({ id: "2", name: "", username: "u", uris: ["y.test"] });
      const blankName = buildCipher({ id: "3", name: "   ", username: "u", uris: ["z.test"] });
      const noUsername = buildCipher({ id: "4", name: "Name", username: "", uris: ["z.test"] });
      expect(findSetsHostname([good, noName, blankName, noUsername])).toHaveLength(0);
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
      const host = normalize("https://münich.example/secure");
      expect(host).toMatch(/^xn--mnich-kva\.example$/);
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
      const sets = findSetsHostname([c1, c2]);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+name:  & My App");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2"]));
    });

    it("does not mix username-present with username-absent, even if names match", () => {
      const noUser = buildCipher({ id: "1", name: "Same", username: "", uris: [] });
      const u1 = buildCipher({ id: "2", name: "Same", username: "u", uris: [] });
      const u2 = buildCipher({ id: "3", name: "Same", username: "u", uris: [] });
      const sets = findSetsHostname([noUser, u1, u2]);
      const keys = sets.map((s) => s.key).sort();
      expect(keys).toEqual(["username+name: u & Same"]);
      const unameSet = sets[0];
      expect(new Set(unameSet.ciphers.map((c) => c.id))).toEqual(new Set(["2", "3"]));
    });

    it("creates a single name-only bucket for 3+ matching ciphers", () => {
      const cs = [1, 2, 3].map((i) =>
        buildCipher({ id: String(i), name: "Cluster", username: "", uris: [] }),
      );
      const sets = findSetsHostname(cs);
      expect(sets).toHaveLength(1);
      expect(sets[0].key).toBe("username+name:  & Cluster");
      expect(new Set(sets[0].ciphers.map((c) => c.id))).toEqual(new Set(["1", "2", "3"]));
    });

    it("does not create a name-only set for a single item or blank name", () => {
      const solo = buildCipher({ id: "1", name: "Solo", username: "", uris: [] });
      const blank = buildCipher({ id: "2", name: "   ", username: "", uris: [] });
      expect(findSetsHostname([solo])).toHaveLength(0);
      expect(findSetsHostname([blank])).toHaveLength(0);
    });
  });

  describe("URI match strategies", () => {
    describe("Hostname", () => {
      it("normalizes host and ignores port, scheme, path, userinfo", () => {
        const keys = keysFor(
          ["HTTPS://user:pass@EXAMPLE.COM:443/a", "http://example.com:8443/b?x=1#y", "example.com"],
          "Hostname",
        );
        expect(keys).toEqual(["example.com"]);
      });

      it("handles IDN via punycode", () => {
        const keys = keysFor(["https://münich.example"], "Hostname");
        expect(keys[0]).toMatch(/^xn--mnich-kva\.example$/);
      });

      it("androidapp scheme yields package id across variants", () => {
        const keys = keysFor(
          [
            "androidapp://com.Example.App/login",
            "androidapp:com.example.app?x=1",
            "  androidapp://COM.EXAMPLE.APP  ",
          ],
          "Hostname",
        );
        expect(keys).toEqual(["com.example.app"]);
      });
    });

    describe("Base", () => {
      it("returns second-level + TLD for common domains", () => {
        const keys = keysFor(["https://a.b.example.org", "http://example.org"], "Base");
        expect(keys).toEqual(["example.org"]);
      });

      it("returns host unchanged for IP and single-label host", () => {
        const keys = keysFor(["http://192.168.0.10/x", "localhost:3000"], "Base");
        expect(keys).toEqual(["192.168.0.10", "localhost"]);
      });

      it("androidapp returns package id", () => {
        const keys = keysFor(["androidapp:com.pkg"], "Base");
        expect(keys).toEqual(["com.pkg"]);
      });

      it("PSL: co.uk groups to example.co.uk across subdomains", () => {
        const keys = keysFor(["https://a.b.example.co.uk", "http://example.co.uk"], "Base");
        expect(keys).toEqual(["example.co.uk"]);
      });

      it("PSL: github.io keeps owners separate (user1 vs user2)", () => {
        const keys = keysFor(["https://user1.github.io", "https://user2.github.io"], "Base").sort();
        expect(keys).toEqual(["user1.github.io", "user2.github.io"]);
      });

      it("PSL: subdomains under user.github.io collapse to user.github.io", () => {
        const keys = keysFor(["https://a.user.github.io", "https://b.user.github.io"], "Base");
        expect(keys).toEqual(["user.github.io"]);
      });

      it("PSL: appspot.com keeps apps separate; subdomains under same app collapse", () => {
        const sep = keysFor(["http://foo.appspot.com", "https://bar.appspot.com"], "Base").sort();
        expect(sep).toEqual(["bar.appspot.com", "foo.appspot.com"]);

        const collapse = keysFor(["http://a.foo.appspot.com", "https://b.foo.appspot.com"], "Base");
        expect(collapse).toEqual(["foo.appspot.com"]);
      });
    });

    describe("Host", () => {
      it("includes port when present, otherwise host only", () => {
        const keys = keysFor(["http://example.com", "http://example.com:8080"], "Host");
        expect(keys).toEqual(["example.com", "example.com:8080"]);
      });

      it("formats IPv6 with port as host:port", () => {
        const keys = keysFor(["http://[2001:db8::1]:8080/x"], "Host");
        expect(keys).toEqual(["2001:db8::1:8080"]);
      });

      it("androidapp returns package id (no port)", () => {
        const keys = keysFor(["androidapp://com.pkg/x"], "Host");
        expect(keys).toEqual(["com.pkg"]);
      });
    });

    describe("Exact", () => {
      it("returns full normalized URL including path/query/fragment, lowercased", () => {
        const keys = keysFor(["HTTPS://EXAMPLE.com:8443/A/B?X=1#Frag"], "Exact");
        expect(keys).toEqual(["https://example.com:8443/a/b?x=1#frag"]);
      });

      it("androidapp returns androidapp:package", () => {
        const keys = keysFor(["androidapp:COM.PKG/path"], "Exact");
        expect(keys).toEqual(["androidapp:com.pkg"]);
      });
    });

    describe("Fallback URL parsing path for strategies", () => {
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

      it("Hostname still extracts the host via fallback", () => {
        const keys = keysFor(
          ["custom+scheme://User:Pass@Sub.Domain.Example.com:8080/x"],
          "Hostname",
        );
        expect(keys).toEqual(["sub.domain.example.com"]);
      });

      it("Host returns host:port if numeric port; strips non-numeric suffix", () => {
        const strat = "Host";
        expect(keysFor(["weird://host:8080/abc"], strat)).toEqual(["host:8080"]);
        expect(keysFor(["weird://host:notaport/abc"], strat)).toEqual(["host"]);
      });

      it("Base extracts registrable domain via fallback (PSL)", () => {
        const keys = keysFor(["custom+scheme://a.b.example.co.uk/path"], "Base");
        expect(keys).toEqual(["example.co.uk"]);
      });
    });
  });
});
