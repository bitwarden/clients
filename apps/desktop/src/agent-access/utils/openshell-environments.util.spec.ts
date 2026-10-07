import { OpenShellSandboxCredential } from "../models/openshell-management";

import {
  applyOpenShellSecretRefs,
  clearOpenShellSandboxMeta,
  secretRefsFromCredentials,
  secretRefsOfEnvironment,
} from "./openshell-environments.util";

const ID_A = "1c7a6e2f-4d3b-4e8f-8a21-bb22cc33dd44";
const ID_B = "2d8b7f30-5e4c-4f90-9b32-cc33dd44ee55";
const SET_ID = "3e9c8041-6f5d-4aa1-8c43-dd44ee55ff66";

const credential = (
  overrides: Partial<OpenShellSandboxCredential> = {},
  envVar = "GH_TOKEN",
  id = ID_A,
): OpenShellSandboxCredential => ({
  providerName: "github-box",
  profileId: "github",
  managed: true,
  bindings: [{ envVar, resourceType: "secret", id, field: "value", label: "GitHub" }],
  ...overrides,
});

describe("openshell environments utilities (§M8.20 rule 17)", () => {
  describe("secretRefsFromCredentials", () => {
    it("captures a managed single-binding credential with its profile", () => {
      expect(secretRefsFromCredentials([credential()])).toEqual({
        refs: [
          {
            resourceType: "secret",
            id: ID_A,
            field: "value",
            label: "GitHub",
            profileId: "github",
            envVar: "GH_TOKEN",
          },
        ],
        skipped: 0,
      });
    });

    it("skips unmanaged, multi-binding, profile-less and duplicate-env-var credentials, and counts them", () => {
      const multi = credential();
      multi.bindings.push({ ...multi.bindings[0], envVar: "OTHER" });
      const result = secretRefsFromCredentials([
        credential({ managed: false, bindings: [] }),
        multi,
        credential({ profileId: null }),
        credential(),
        credential({}, "GH_TOKEN", ID_B),
      ]);
      expect(result.refs).toHaveLength(1);
      expect(result.skipped).toBe(4);
    });

    it("never carries anything but ids and names", () => {
      const text = JSON.stringify(secretRefsFromCredentials([credential()]));
      expect(text).not.toContain("bw://");
    });
  });

  describe("secretRefsOfEnvironment", () => {
    const ref = secretRefsFromCredentials([credential()]).refs[0];
    const base = { id: ID_B, name: "Dev", description: "" };

    it("returns the set's refs, the inline refs, none, or null when the set is gone", () => {
      const sets = [{ id: SET_ID, name: "Work", secrets: [ref] }];
      expect(secretRefsOfEnvironment({ ...base, secretSetId: SET_ID }, sets)).toEqual([ref]);
      expect(secretRefsOfEnvironment({ ...base, secrets: [ref] }, sets)).toEqual([ref]);
      expect(secretRefsOfEnvironment(base, sets)).toEqual([]);
      expect(secretRefsOfEnvironment({ ...base, secretSetId: SET_ID }, [])).toBeNull();
    });
  });

  describe("applyOpenShellSecretRefs", () => {
    let add: jest.Mock;
    let originalIpc: unknown;
    const refs = secretRefsFromCredentials([
      credential(),
      credential({ profileId: "openai" }, "OPENAI_KEY", ID_B),
    ]).refs;

    beforeEach(() => {
      add = jest.fn().mockResolvedValue({ ok: true, data: undefined });
      originalIpc = (global as any).ipc;
      (global as any).ipc = {
        agentAccess: { addOpenShellCredential: add, setOpenShellSandboxMeta: jest.fn() },
      };
    });
    afterEach(() => {
      (global as any).ipc = originalIpc;
    });

    it("adds one at a time, in order, with ids and names only", async () => {
      expect(await applyOpenShellSecretRefs("box", refs)).toEqual({ added: 2, failures: [] });
      expect(add).toHaveBeenCalledTimes(2);
      expect(add.mock.calls[0][0]).toEqual({
        sandboxName: "box",
        profileId: "github",
        bindings: [
          {
            envVar: "GH_TOKEN",
            resourceType: "secret",
            id: ID_A,
            field: "value",
            label: "GitHub",
          },
        ],
      });
    });

    it("keeps going after a failure and reports each", async () => {
      add.mockResolvedValueOnce({ ok: false, error: "gatewayUnreachable", message: "m" });
      const result = await applyOpenShellSecretRefs("box", refs);
      expect(result.added).toBe(1);
      expect(result.failures).toEqual([
        { label: "GitHub", error: "gatewayUnreachable", message: "m" },
      ]);
      expect(add).toHaveBeenCalledTimes(2);
    });

    it("retries a taken provider name with a suffix", async () => {
      add.mockResolvedValueOnce({ ok: false, error: "alreadyExists" });
      await applyOpenShellSecretRefs("box", [refs[0]]);
      expect(add.mock.calls[1][0].providerName).toBe("github-box-2");
    });

    it("clears sandbox metadata best effort and never throws", async () => {
      const set = jest.fn().mockRejectedValue(new Error("x"));
      (global as any).ipc = { agentAccess: { setOpenShellSandboxMeta: set } };
      await expect(clearOpenShellSandboxMeta("box")).resolves.toBeUndefined();
      expect(set).toHaveBeenCalledWith({ name: "box", purpose: "", color: null });
    });
  });
});
