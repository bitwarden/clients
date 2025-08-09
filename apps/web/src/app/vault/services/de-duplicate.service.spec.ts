import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { DeDuplicateService } from "./de-duplicate.service";

const cipherServiceStub = {
  getAllDecrypted: jest.fn(),
  delete: jest.fn(),
};

const dialogServiceStub = {
  open: jest.fn(),
};

function buildCipher({
  id,
  name,
  username,
  password,
  folderId = null,
  organizationId = null,
}: {
  id: string;
  name: string;
  username: string;
  password: string;
  folderId?: string | null;
  organizationId?: string | null;
}): CipherView {
  const cv = new CipherView();
  (cv as any).id = id;
  (cv as any).name = name;
  (cv as any).folderId = folderId;
  (cv as any).organizationId = organizationId;
  (cv as any).login = { username, password };
  return cv;
}

describe("DeDuplicateService - duplicate detection", () => {
  let service: DeDuplicateService;

  beforeEach(() => {
    jest.clearAllMocks();
    const cipherAuthorizationServiceStub = {};
    service = new DeDuplicateService(
      cipherServiceStub as any,
      dialogServiceStub as any,
      cipherAuthorizationServiceStub as any,
    );
  });

  function findSets(ciphers: CipherView[]) {
    return (service as any).findDuplicateSets(ciphers) as { key: string; ciphers: CipherView[] }[];
  }

  it("does NOT group ciphers with same username/password but different names", () => {
    const c1 = buildCipher({
      id: "1",
      name: "SiteA",
      username: "user@example.com",
      password: "pass",
    });
    const c2 = buildCipher({
      id: "2",
      name: "SiteB",
      username: "user@example.com",
      password: "pass",
    });
    const sets = findSets([c1, c2]);
    expect(sets.length).toBe(0);
  });

  it("does NOT group ciphers with same username/password but different folders", () => {
    const c1 = buildCipher({
      id: "1",
      name: "Site",
      username: "user@example.com",
      password: "pass",
      folderId: "folder1",
    });
    const c2 = buildCipher({
      id: "2",
      name: "Site",
      username: "user@example.com",
      password: "pass",
      folderId: "folder2",
    });
    const sets = findSets([c1, c2]);
    expect(sets.length).toBe(0);
  });

  it("does NOT group ciphers with same username/password but different organizations", () => {
    const c1 = buildCipher({
      id: "1",
      name: "Site",
      username: "user@example.com",
      password: "pass",
      organizationId: "org1",
    });
    const c2 = buildCipher({
      id: "2",
      name: "Site",
      username: "user@example.com",
      password: "pass",
      organizationId: "org2",
    });
    const sets = findSets([c1, c2]);
    expect(sets.length).toBe(0);
  });

  it("clusterKey returns username if present, otherwise name, otherwise empty string", () => {
    const c1 = buildCipher({ id: "1", name: "Demo", username: "u", password: "p" });
    const c2 = buildCipher({ id: "2", name: "Demo", username: "", password: "p" });
    const c3 = buildCipher({ id: "3", name: "", username: "", password: "p" });
    expect((service as any).clusterKey([c1])).toBe("u");
    expect((service as any).clusterKey([c2])).toBe("Demo");
    expect((service as any).clusterKey([c3])).toBe("");
  });

  it("canonicalName strips (username) suffix correctly", () => {
    const c1 = buildCipher({ id: "1", name: "Demo (u)", username: "u", password: "p" });
    const c2 = buildCipher({ id: "2", name: "Demo", username: "u", password: "p" });
    expect((service as any).canonicalName(c1)).toBe("Demo");
    expect((service as any).canonicalName(c2)).toBe("Demo");
  });

  it("buildCredentialBuckets buckets ciphers by username, password, org, folder", () => {
    const c1 = buildCipher({
      id: "1",
      name: "A",
      username: "u",
      password: "p",
      folderId: "f1",
      organizationId: "o1",
    });
    const c2 = buildCipher({
      id: "2",
      name: "B",
      username: "u",
      password: "p",
      folderId: "f1",
      organizationId: "o1",
    });
    const map = (service as any).buildCredentialBuckets([c1, c2]);
    expect(map.size).toBe(1);
    expect(map.values().next().value.length).toBe(2);
  });

  it("buildCredentialBuckets skips ciphers with missing username or password", () => {
    const c1 = buildCipher({ id: "1", name: "A", username: "", password: "p" });
    const c2 = buildCipher({ id: "2", name: "B", username: "u", password: "" });
    const map = (service as any).buildCredentialBuckets([c1, c2]);
    expect(map.size).toBe(0);
  });

  it("buildNameBuckets buckets ciphers by canonical name, username, org, folder, skipping consumed", () => {
    const c1 = buildCipher({
      id: "1",
      name: "Demo (u)",
      username: "u",
      password: "p",
      folderId: "f1",
      organizationId: "o1",
    });
    const c2 = buildCipher({
      id: "2",
      name: "Demo",
      username: "u",
      password: "p",
      folderId: "f1",
      organizationId: "o1",
    });
    const consumed = new Set(["1"]);
    const map = (service as any).buildNameBuckets([c1, c2], consumed);
    expect(map.size).toBe(1);
    expect(map.values().next().value[0].id).toBe("2");
  });

  it("groupByName groups ciphers into clusters and singles", () => {
    const c1 = buildCipher({ id: "1", name: "Demo", username: "u", password: "p" });
    const c2 = buildCipher({ id: "2", name: "Demo (u)", username: "u", password: "p" });
    const c3 = buildCipher({ id: "3", name: "Other", username: "u", password: "p" });
    const result = (service as any).groupByName([c1, c2, c3]);
    expect(result.clusters.length).toBe(1);
    expect(result.singles.length).toBe(1);
    expect(result.clusters[0].map((c: CipherView) => c.id)).toEqual(["1", "2"]);
    expect(result.singles[0].id).toBe("3");
  });

  it("isDuplicateByName detects duplicates by name and (username) suffix", () => {
    const c1 = buildCipher({ id: "1", name: "Demo", username: "u", password: "p" });
    const c2 = buildCipher({ id: "2", name: "Demo (u)", username: "u", password: "p" });
    expect((service as any).isDuplicateByName(c1, c2)).toBe(true);
    expect((service as any).isDuplicateByName(c2, c1)).toBe(true);
    const c3 = buildCipher({ id: "3", name: "Other", username: "u", password: "p" });
    expect((service as any).isDuplicateByName(c1, c3)).toBe(false);
  });

  it("groups credential-identical name variants (Name vs Name (username))", () => {
    const c1 = buildCipher({
      id: "1",
      name: "Example",
      username: "user@example.com",
      password: "pass",
    });
    const c2 = buildCipher({
      id: "2",
      name: "Example (user@example.com)",
      username: "user@example.com",
      password: "pass",
    });

    const sets = findSets([c1, c2]);
    expect(sets.length).toBe(1);
    expect(sets[0].ciphers.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });

  it("does NOT group different domains with same creds when names are unrelated", () => {
    const c1 = buildCipher({
      id: "1",
      name: "accounts.hackthebox.com",
      username: "user@example.com",
      password: "same",
    });
    const c2 = buildCipher({
      id: "2",
      name: "forum.hackthebox.com",
      username: "user@example.com",
      password: "same",
    });

    const sets = findSets([c1, c2]);
    expect(sets.length).toBe(0);
  });

  it("groups name variants in secondary pass even if passwords differ (credential grouping skipped)", () => {
    const c1 = buildCipher({
      id: "1",
      name: "Demo",
      username: "user@example.com",
      password: "p1",
    });
    const c2 = buildCipher({
      id: "2",
      name: "Demo (user@example.com)",
      username: "user@example.com",
      password: "different",
    });

    const sets = findSets([c1, c2]);
    expect(sets.length).toBe(1);
    expect(sets[0].ciphers.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });

  it("keeps credential-identical but different folders separate", () => {
    const c1 = buildCipher({
      id: "1",
      name: "accounts.example.com",
      username: "u",
      password: "p",
      folderId: "f1",
    });
    const c2 = buildCipher({
      id: "2",
      name: "forum.example.com",
      username: "u",
      password: "p",
      folderId: "f2",
    });

    const sets = findSets([c1, c2]);
    expect(sets.length).toBe(0);
  });

  it("does not merge across organizations when org differs", () => {
    const c1 = buildCipher({
      id: "1",
      name: "Example",
      username: "u",
      password: "p",
      organizationId: "org1",
    });
    const c2 = buildCipher({
      id: "2",
      name: "Example (u)",
      username: "u",
      password: "p",
      organizationId: "org2",
    });

    const sets = findSets([c1, c2]);
    expect(sets.length).toBe(0);
  });

  it("clusters three variants correctly (base + two username suffixed)", () => {
    const c1 = buildCipher({ id: "1", name: "Demo", username: "u", password: "p" });
    const c2 = buildCipher({ id: "2", name: "Demo (u)", username: "u", password: "p" });
    const c3 = buildCipher({ id: "3", name: "Demo (u)", username: "u", password: "p" });

    const sets = findSets([c1, c2, c3]);
    expect(sets.length).toBe(1);
    expect(sets[0].ciphers.map((c) => c.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("skips singleton groups even after splitting clusters", () => {
    // Two credential-equal entries but only one matches name variant rule with the seed
    const c1 = buildCipher({ id: "1", name: "Alpha", username: "u", password: "p" });
    const c2 = buildCipher({ id: "2", name: "Beta", username: "u", password: "p" });
    const sets = findSets([c1, c2]);
    expect(sets.length).toBe(0);
  });

  it("secondary pass does not re-add ciphers already consumed in credential pass", () => {
    const c1 = buildCipher({ id: "1", name: "Demo", username: "u", password: "p" });
    const c2 = buildCipher({ id: "2", name: "Demo (u)", username: "u", password: "p" });
    const c3 = buildCipher({ id: "3", name: "Demo (u)", username: "u", password: "DIFF" });

    const sets = findSets([c1, c2, c3]);
    const serialized = sets.map((s) =>
      s.ciphers
        .map((c) => c.id)
        .sort()
        .join("|"),
    );
    const unique = new Set(serialized);
    expect(unique.size).toBe(serialized.length);
  });

  it("does not group different usernames with same base name after deletions", () => {
    const c1 = buildCipher({ id: "1", name: "Service", username: "alice", password: "p1" });
    const c2 = buildCipher({ id: "2", name: "Service (alice)", username: "alice", password: "p2" });
    const c3 = buildCipher({ id: "3", name: "Service", username: "bob", password: "p3" });
    const c4 = buildCipher({ id: "4", name: "Service (bob)", username: "bob", password: "p4" });
    const sets = findSets([c1, c2, c3, c4]);
    // Expect two separate groups (alice-related, bob-related) not merged together
    expect(sets.length).toBe(2);
    const groupedIds = sets.map((s) => s.ciphers.map((c) => c.id).sort());
    expect(groupedIds).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(["1", "2"]),
        expect.arrayContaining(["3", "4"]),
      ]),
    );
    // Ensure no cross-username cluster
    groupedIds.forEach((ids) => {
      const usernames = ids.map(
        (id) =>
          ({
            "1": "alice",
            "2": "alice",
            "3": "bob",
            "4": "bob",
          })[id]!,
      );
      expect(new Set(usernames).size).toBe(1);
    });
  });
});
