import { passwords } from "@bitwarden/desktop-napi";
import { LogService } from "@bitwarden/logging";

import { AgentAccessGrantScope } from "../models/agent-access-grant";

import { AgentAccessGrantStoreService } from "./agent-access-grant-store.service";

jest.mock("@bitwarden/desktop-napi", () => ({
  passwords: {
    getPassword: jest.fn(),
    setPassword: jest.fn(),
    PASSWORD_NOT_FOUND: "Password not found",
  },
}));

const KEYCHAIN_SERVICE_NAME = "Bitwarden_agent_access";

describe("AgentAccessGrantStoreService", () => {
  let store: AgentAccessGrantStoreService;
  let mockLogService: jest.Mocked<LogService>;
  let backingBlob: string | null;

  beforeEach(() => {
    backingBlob = null;
    mockLogService = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warning: jest.fn(),
    } as any;

    (passwords.getPassword as jest.Mock).mockImplementation(async () => {
      if (backingBlob == null) {
        throw new Error(passwords.PASSWORD_NOT_FOUND);
      }
      return backingBlob;
    });
    (passwords.setPassword as jest.Mock).mockImplementation(
      async (_service: string, _key: string, value: string) => {
        backingBlob = value;
      },
    );

    store = new AgentAccessGrantStoreService(mockLogService, KEYCHAIN_SERVICE_NAME);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("list", () => {
    it("returns an empty array before anything is stored", async () => {
      expect(await store.list()).toEqual([]);
    });

    it("returns every persisted grant", async () => {
      await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.a",
        displayName: "A",
        scope: AgentAccessGrantScope.AllLogins,
      });
      await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.b",
        displayName: "B",
        scope: AgentAccessGrantScope.AllLogins,
      });

      const grants = await store.list();
      expect(grants).toHaveLength(2);
      expect(grants.map((g) => g.displayName)).toEqual(["A", "B"]);
    });
  });

  describe("upsert", () => {
    it("creates a new grant with matching createdAt/lastUsedAt on first use", async () => {
      const grant = await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.anysphere.cursor",
        displayName: "Cursor",
        exePath: "/Applications/Cursor.app",
        scope: AgentAccessGrantScope.AllLogins,
      });

      expect(grant.id).toEqual(expect.any(String));
      expect(grant.displayName).toBe("Cursor");
      expect(grant.exePath).toBe("/Applications/Cursor.app");
      expect(grant.scope).toBe("allLogins");
      expect(grant.createdAt).toBe(grant.lastUsedAt);
    });

    it("refreshes lastUsedAt (and display metadata) on a second upsert for the same key, keeping the id and createdAt", async () => {
      const first = await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.anysphere.cursor",
        displayName: "Cursor",
        exePath: "/Applications/Cursor.app",
        scope: AgentAccessGrantScope.AllLogins,
      });

      jest.spyOn(Date, "now").mockReturnValue((first.createdAt + 100) * 1000);

      const second = await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.anysphere.cursor",
        displayName: "Cursor (renamed)",
        exePath: "/Applications/Cursor.app",
        scope: AgentAccessGrantScope.AllLogins,
      });

      expect(second.id).toBe(first.id);
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.lastUsedAt).toBe(first.createdAt + 100);
      expect(second.displayName).toBe("Cursor (renamed)");
      expect(await store.list()).toHaveLength(1);

      (Date.now as jest.Mock).mockRestore?.();
    });

    it("keys unsigned/invalid-signature peers by path, not signature identity", async () => {
      const grant = await store.upsert({
        signatureKind: "path",
        signatureIdentity: "/usr/local/bin/some-agent",
        displayName: "Some agent",
        scope: AgentAccessGrantScope.AllLogins,
      });

      expect(
        await store.find({ signatureKind: "path", signatureIdentity: "/usr/local/bin/some-agent" }),
      ).toEqual(grant);
    });

    it("treats a binary swap at the same path (different key) as a distinct grant", async () => {
      await store.upsert({
        signatureKind: "path",
        signatureIdentity: "/usr/local/bin/some-agent",
        displayName: "Old binary",
        scope: AgentAccessGrantScope.AllLogins,
      });

      // Same path, but now signed — a real key change, not a refresh of the path-keyed grant.
      await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.new",
        displayName: "New signed binary",
        scope: AgentAccessGrantScope.AllLogins,
      });

      expect(await store.list()).toHaveLength(2);
    });
  });

  describe("find", () => {
    it("returns null when no grant matches the key", async () => {
      expect(
        await store.find({ signatureKind: "macosTeamId", signatureIdentity: "nope" }),
      ).toBeNull();
    });

    it("finds a grant by its (signatureKind, signatureIdentity) key", async () => {
      const grant = await store.upsert({
        signatureKind: "windowsPublisher",
        signatureIdentity: "CN=Example Corp",
        displayName: "Example",
        scope: AgentAccessGrantScope.AllLogins,
      });

      expect(
        await store.find({
          signatureKind: "windowsPublisher",
          signatureIdentity: "CN=Example Corp",
        }),
      ).toEqual(grant);
    });
  });

  describe("remove", () => {
    it("removes a grant by id", async () => {
      const grant = await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.a",
        displayName: "A",
        scope: AgentAccessGrantScope.AllLogins,
      });

      await store.remove(grant.id);

      expect(await store.list()).toEqual([]);
    });

    it("is a no-op when removing an id that doesn't exist", async () => {
      await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.a",
        displayName: "A",
        scope: AgentAccessGrantScope.AllLogins,
      });

      await expect(store.remove("does-not-exist")).resolves.not.toThrow();
      expect(await store.list()).toHaveLength(1);
    });
  });

  describe("error handling", () => {
    it("treats an unparsable stored blob as an empty grant list rather than throwing", async () => {
      backingBlob = "{not valid json";

      expect(await store.list()).toEqual([]);
      expect(mockLogService.error).toHaveBeenCalled();
    });

    // A transient (non-NOT_FOUND) keychain read failure preceding a write must abort the write
    // rather than being swallowed to an empty store: load -> mutate -> save on top of a bogus
    // "empty" view would persist that empty view, destroying every existing grant.
    it("aborts an upsert (rather than clobbering existing grants) when the read that precedes it fails transiently", async () => {
      const existing = await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.a",
        displayName: "A",
        scope: AgentAccessGrantScope.AllLogins,
      });

      (passwords.getPassword as jest.Mock).mockRejectedValueOnce(new Error("keychain locked"));

      await expect(
        store.upsert({
          signatureKind: "macosTeamId",
          signatureIdentity: "TEAMID:com.b",
          displayName: "B",
          scope: AgentAccessGrantScope.AllLogins,
        }),
      ).rejects.toThrow("keychain locked");

      // Nothing was written, and the pre-existing grant is untouched.
      expect(await store.list()).toEqual([existing]);
    });

    it("aborts a remove (rather than clobbering existing grants) when the read that precedes it fails transiently", async () => {
      const existing = await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.a",
        displayName: "A",
        scope: AgentAccessGrantScope.AllLogins,
      });

      (passwords.getPassword as jest.Mock).mockRejectedValueOnce(new Error("keychain locked"));

      await expect(store.remove(existing.id)).rejects.toThrow("keychain locked");
      expect(await store.list()).toEqual([existing]);
    });

    it("still treats NOT_FOUND (nothing stored yet) as an empty store on the write path, not an error", async () => {
      // backingBlob starts null, i.e. PASSWORD_NOT_FOUND from the mock — this is the ordinary
      // first-ever-grant case, not a failure, so upsert must succeed rather than abort.
      const grant = await store.upsert({
        signatureKind: "macosTeamId",
        signatureIdentity: "TEAMID:com.a",
        displayName: "A",
        scope: AgentAccessGrantScope.AllLogins,
      });

      expect(grant).not.toBeNull();
      expect(await store.list()).toEqual([grant]);
    });
  });

  describe("fail-closed on empty attestable identity", () => {
    it("refuses to persist a grant with an empty signatureIdentity", async () => {
      const grant = await store.upsert({
        signatureKind: "path",
        signatureIdentity: "",
        displayName: "Unknown application",
        scope: AgentAccessGrantScope.AllLogins,
      });

      expect(grant).toBeNull();
      expect(await store.list()).toEqual([]);
      expect(mockLogService.warning).toHaveBeenCalled();
    });

    it("refuses to persist a grant with a whitespace-only signatureIdentity", async () => {
      const grant = await store.upsert({
        signatureKind: "path",
        signatureIdentity: "   ",
        displayName: "Unknown application",
        scope: AgentAccessGrantScope.AllLogins,
      });

      expect(grant).toBeNull();
      expect(await store.list()).toEqual([]);
    });

    it("never matches a grant lookup keyed by an empty signatureIdentity, even without touching storage", async () => {
      expect(await store.find({ signatureKind: "path", signatureIdentity: "" })).toBeNull();
      expect(passwords.getPassword).not.toHaveBeenCalled();
    });
  });
});
