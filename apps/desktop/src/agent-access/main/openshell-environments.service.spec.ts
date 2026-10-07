import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OpenShellDetectionResult } from "../models/openshell";

import { OpenShellEnabledState } from "./openshell-enabled-state";
import {
  OpenShellEnvironmentsStore,
  OpenShellEnvironmentsStoreFs,
} from "./openshell-environments-store";
import { OpenShellEnvironmentsService } from "./openshell-environments.service";

const SECRET = "1c7a6e2f-4d3b-4e8f-8a21-bb22cc33dd44";
const MISSING = "2d8b7f30-5e4c-4f90-9b32-cc33dd44ee55";
const REF = {
  resourceType: "secret",
  id: SECRET,
  field: "value",
  label: "GH",
  profileId: "github",
  envVar: "GH_TOKEN",
};

function detection(overrides: Partial<OpenShellDetectionResult> = {}): OpenShellDetectionResult {
  return {
    present: true,
    platformSupported: true,
    cliPath: "/opt/homebrew/bin/openshell",
    gateways: [
      { name: "home", endpoint: "e", authMode: "mtls", active: false, authSupported: true },
      { name: "work", endpoint: "e", authMode: "mtls", active: true, authSupported: true },
    ],
    ...overrides,
  } as OpenShellDetectionResult;
}

function setup(
  options: { det?: OpenShellDetectionResult; available?: boolean; enabled?: boolean } = {},
) {
  const state = { content: null as string | null };
  const adapter: OpenShellEnvironmentsStoreFs = {
    read: jest.fn(async () => state.content),
    writeAtomic: jest.fn(async (_p: string, content: string) => {
      state.content = content;
    }),
  };
  const log = mock<LogService>();
  const enabled = new OpenShellEnabledState();
  enabled.set(options.enabled ?? true);
  const detect = jest.fn(async () => options.det ?? detection());
  const service = new OpenShellEnvironmentsService(
    log,
    new OpenShellEnvironmentsStore(log, "/data", adapter),
    detect,
    async () => options.available ?? true,
    enabled,
  );
  const stored = () => JSON.parse(state.content ?? "{}");
  return { service, adapter, detect, log, stored };
}

describe("OpenShellEnvironmentsService (§M8.20 rule 17)", () => {
  describe("gate", () => {
    it("answers unsupported for every method, without touching the store, when the toggle is off", async () => {
      const { service, adapter } = setup({ enabled: false });
      const results = await Promise.all([
        service.listEnvironments(),
        service.saveEnvironment({ name: "x" }),
        service.deleteEnvironment({ id: SECRET }),
        service.listSecretSets(),
        service.saveSecretSet({ name: "x", secrets: [REF] }),
        service.deleteSecretSet({ id: SECRET }),
        service.getSandboxMeta(),
        service.setSandboxMeta({ name: "box", purpose: "p", color: null }),
      ]);
      for (const r of results) {
        expect(r).toEqual({ ok: false, error: "unsupported" });
      }
      expect(adapter.read).not.toHaveBeenCalled();
      expect(adapter.writeAtomic).not.toHaveBeenCalled();
    });

    it("is unsupported when management is unavailable or detection says so", async () => {
      expect((await setup({ available: false }).service.listEnvironments()).error).toBe(
        "unsupported",
      );
      for (const det of [detection({ present: false }), detection({ platformSupported: false })]) {
        expect((await setup({ det }).service.listEnvironments()).error).toBe("unsupported");
      }
    });

    it("uses the active gateway, else the first, else the default", async () => {
      const a = setup();
      await a.service.setSandboxMeta({ name: "box", purpose: "p", color: null });
      expect(Object.keys(a.stored().gateways)).toEqual(["work"]);
      const b = setup({ det: detection({ gateways: [] }) });
      await b.service.setSandboxMeta({ name: "box", purpose: "p", color: null });
      expect(Object.keys(b.stored().gateways)).toEqual(["openshell"]);
    });

    it("never throws when detection rejects", async () => {
      const { service, detect } = setup();
      detect.mockRejectedValue(new Error("boom"));
      expect(await service.listEnvironments()).toEqual({ ok: false, error: "failed" });
    });
  });

  describe("secret sets", () => {
    it("creates, lists, renames in place and deletes", async () => {
      const { service } = setup();
      const created = await service.saveSecretSet({ name: " Work ", secrets: [REF] });
      expect(created.ok).toBe(true);
      const id = created.data!.id;
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(created.data!.name).toBe("Work");

      const renamed = await service.saveSecretSet({ id, name: "Team", secrets: [REF] });
      expect(renamed.data).toEqual({ id, name: "Team", secrets: [REF] });
      expect((await service.listSecretSets()).data).toHaveLength(1);

      expect(await service.deleteSecretSet({ id })).toEqual({ ok: true, data: undefined });
      expect((await service.listSecretSets()).data).toEqual([]);
      expect((await service.deleteSecretSet({ id })).error).toBe("notFound");
    });

    it("never takes an id for a new set and rejects an unknown id", async () => {
      const { service } = setup();
      expect((await service.saveSecretSet({ id: MISSING, name: "x", secrets: [REF] })).error).toBe(
        "notFound",
      );
      expect((await service.saveSecretSet({ id: "bad", name: "x", secrets: [REF] })).error).toBe(
        "invalidInput",
      );
    });

    it.each([
      ["no name", { name: " ", secrets: [REF] }],
      ["no secrets", { name: "x", secrets: [] }],
      ["a denied env var", { name: "x", secrets: [{ ...REF, envVar: "PATH" }] }],
      ["a non-object", "x"],
      ["a bad field", { name: "x", secrets: [{ ...REF, field: "password" }] }],
    ])("rejects %s with invalidInput and writes nothing", async (_n, request) => {
      const { service, adapter } = setup();
      expect((await service.saveSecretSet(request)).error).toBe("invalidInput");
      expect(adapter.writeAtomic).not.toHaveBeenCalled();
    });

    it("refuses a duplicate name case-insensitively", async () => {
      const { service } = setup();
      await service.saveSecretSet({ name: "Work", secrets: [REF] });
      expect((await service.saveSecretSet({ name: "work", secrets: [REF] })).error).toBe(
        "alreadyExists",
      );
    });

    it("refuses to delete a set an environment uses", async () => {
      const { service } = setup();
      const set = (await service.saveSecretSet({ name: "Work", secrets: [REF] })).data!;
      await service.saveEnvironment({ name: "Dev", secretSetId: set.id });
      const result = await service.deleteSecretSet({ id: set.id });
      expect(result.error).toBe("failed");
      expect(result.message).toContain("1 environment");
      expect((await service.listSecretSets()).data).toHaveLength(1);
    });

    it("stores ids and names only, never anything shaped like a value or reference", async () => {
      const { service, stored } = setup();
      await service.saveSecretSet({ name: "Work", secrets: [{ ...REF, value: "hunter2" }] });
      const text = JSON.stringify(stored());
      expect(text).not.toContain("hunter2");
      expect(text).not.toContain("bw://");
    });
  });

  describe("environments", () => {
    it("creates, updates and deletes", async () => {
      const { service } = setup();
      const created = await service.saveEnvironment({
        name: "Dev",
        description: "d",
        from: "ghcr.io/acme/base:1",
        cpu: "2",
        memory: "4Gi",
        secrets: [REF],
      });
      expect(created.ok).toBe(true);
      const id = created.data!.id;
      const updated = await service.saveEnvironment({ id, name: "Dev2", template: "tpl" });
      expect(updated.data).toEqual({ id, name: "Dev2", description: "", template: "tpl" });
      expect((await service.listEnvironments()).data).toHaveLength(1);
      expect((await service.deleteEnvironment({ id })).ok).toBe(true);
      expect((await service.deleteEnvironment({ id })).error).toBe("notFound");
    });

    it("requires an existing set for secretSetId", async () => {
      const { service } = setup();
      expect((await service.saveEnvironment({ name: "Dev", secretSetId: MISSING })).error).toBe(
        "notFound",
      );
    });

    it("refuses a duplicate name and an update of an unknown id", async () => {
      const { service } = setup();
      await service.saveEnvironment({ name: "Dev" });
      expect((await service.saveEnvironment({ name: "DEV" })).error).toBe("alreadyExists");
      expect((await service.saveEnvironment({ id: MISSING, name: "Other" })).error).toBe(
        "notFound",
      );
    });

    it.each([
      ["a path as image", { name: "x", from: "../root" }],
      ["both image and template", { name: "x", from: "a/b", template: "t" }],
      ["a set and inline secrets", { name: "x", secretSetId: SECRET, secrets: [REF] }],
      ["a flag-like cpu", { name: "x", cpu: "--rm" }],
      ["null", null],
    ])("rejects %s before any store access", async (_n, request) => {
      const { service, adapter } = setup();
      expect((await service.saveEnvironment(request)).error).toBe("invalidInput");
      expect(adapter.read).not.toHaveBeenCalled();
    });

    it("keeps environments per gateway", async () => {
      const a = setup();
      await a.service.saveEnvironment({ name: "Dev" });
      expect(Object.keys(a.stored().gateways)).toEqual(["work"]);
    });

    it("reports a failed write as failed", async () => {
      const { service, adapter } = setup();
      (adapter.writeAtomic as jest.Mock).mockRejectedValue(new Error("disk"));
      expect((await service.saveEnvironment({ name: "Dev" })).error).toBe("failed");
    });
  });

  describe("sandbox metadata", () => {
    it("sets, lists and clears with an empty value", async () => {
      const { service } = setup();
      expect(
        await service.setSandboxMeta({ name: "box", purpose: " a\nb ", color: "green" }),
      ).toEqual({ ok: true, data: undefined });
      expect((await service.getSandboxMeta()).data).toEqual([
        { name: "box", purpose: "a b", color: "green" },
      ]);
      await service.setSandboxMeta({ name: "box", purpose: "", color: null });
      expect((await service.getSandboxMeta()).data).toEqual([]);
    });

    it("keeps a color alone and a purpose alone", async () => {
      const { service } = setup();
      await service.setSandboxMeta({ name: "a", purpose: "", color: "red" });
      await service.setSandboxMeta({ name: "b", purpose: "p", color: null });
      expect((await service.getSandboxMeta()).data).toHaveLength(2);
    });

    it("caps the purpose at 120 characters", async () => {
      const { service } = setup();
      await service.setSandboxMeta({ name: "box", purpose: "x".repeat(500), color: null });
      expect((await service.getSandboxMeta()).data![0].purpose).toHaveLength(120);
    });

    it("clearing something that is not there writes nothing", async () => {
      const { service, adapter } = setup();
      expect(await service.setSandboxMeta({ name: "box", purpose: "", color: null })).toEqual({
        ok: true,
        data: undefined,
      });
      expect(adapter.writeAtomic).not.toHaveBeenCalled();
    });

    it.each([
      ["a flag as name", { name: "--x", purpose: "p", color: null }],
      ["a path as name", { name: "../x", purpose: "p", color: null }],
      ["an unknown color", { name: "box", purpose: "p", color: "pink" }],
      ["a non-string purpose", { name: "box", purpose: 4, color: null }],
      ["a missing purpose", { name: "box", color: null }],
    ])("rejects %s", async (_n, request) => {
      const { service, adapter } = setup();
      expect((await service.setSandboxMeta(request)).error).toBe("invalidInput");
      expect(adapter.read).not.toHaveBeenCalled();
    });
  });
});
