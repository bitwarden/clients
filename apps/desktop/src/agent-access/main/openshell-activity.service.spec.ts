import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  AgentAccessActivityEntry,
  AgentAccessActivityOrigin,
  AgentAccessActivityType,
  AgentAccessRequestStatus,
} from "../models/agent-access-activity";

import { OpenShellActivityService } from "./openshell-activity.service";

const row = (
  id: string,
  sandboxId: string | undefined,
  status: AgentAccessRequestStatus,
  timestampMs: string,
  extra: Record<string, unknown> = {},
): AgentAccessActivityEntry =>
  ({
    type: AgentAccessActivityType.CredentialRequest,
    id,
    timestampMs,
    origin: AgentAccessActivityOrigin.OpenShell,
    agentName: "openshell-gateway",
    sandboxId,
    providerId: "provider-secret-id",
    policyDigest: "digest",
    targetIds: ["item-1", "item-2"],
    status,
    ...extra,
  }) as AgentAccessActivityEntry;

describe("OpenShellActivityService", () => {
  let entries: AgentAccessActivityEntry[];
  let available: boolean;
  let service: OpenShellActivityService;

  beforeEach(() => {
    available = true;
    entries = [];
    service = new OpenShellActivityService(
      mock<LogService>(),
      async () => available,
      () => entries,
    );
  });

  it.each([undefined, null, {}, { sandboxId: "" }, { sandboxId: "-x" }, { sandboxId: "a b" }])(
    "rejects an invalid request %p without reading anything",
    async (request) => {
      const getEntries = jest.fn(() => entries);
      const s = new OpenShellActivityService(mock<LogService>(), async () => true, getEntries);
      expect(await s.listActivity(request)).toEqual({ ok: false, error: "invalidInput" });
      expect(getEntries).not.toHaveBeenCalled();
    },
  );

  it("is unsupported when the OpenShell gate is closed", async () => {
    available = false;
    entries = [row("1", "sb-1", AgentAccessRequestStatus.Shared, "1000")];
    expect(await service.listActivity({ sandboxId: "sb-1" })).toEqual({
      ok: false,
      error: "unsupported",
    });
  });

  it("returns only this sandbox's OpenShell rows, newest first, mapped to outcomes", async () => {
    entries = [
      row("1", "sb-1", AgentAccessRequestStatus.Shared, "1000"),
      row("2", "sb-2", AgentAccessRequestStatus.Shared, "2000"),
      row("3", "sb-1", AgentAccessRequestStatus.Denied, "3000"),
      row("4", undefined, AgentAccessRequestStatus.Shared, "4000"),
      row("5", "sb-1", AgentAccessRequestStatus.NotFound, "2500"),
      row("6", "sb-1", AgentAccessRequestStatus.Pending, "5000"),
      row("7", "sb-1", AgentAccessRequestStatus.Shared, "6000", {
        origin: AgentAccessActivityOrigin.Local,
      }),
      { type: AgentAccessActivityType.Lifecycle, id: "8", timestampMs: "1", kind: "error" },
    ] as AgentAccessActivityEntry[];

    const result = await service.listActivity({ sandboxId: "sb-1" });

    expect(result.ok).toBe(true);
    expect(result.data.map((e) => [e.id, e.outcome])).toEqual([
      ["6", "pending"],
      ["3", "denied"],
      ["5", "notFound"],
      ["1", "allowed"],
    ]);
    expect(result.data[3]).toEqual({
      id: "1",
      atMs: 1000,
      agentName: "openshell-gateway",
      outcome: "allowed",
      secretCount: 2,
    });
  });

  it("never returns provider ids, digests or target ids", async () => {
    entries = [row("1", "sb-1", AgentAccessRequestStatus.Shared, "1000")];
    const json = JSON.stringify(await service.listActivity({ sandboxId: "sb-1" }));
    expect(json).not.toContain("provider-secret-id");
    expect(json).not.toContain("digest");
    expect(json).not.toContain("item-1");
  });

  it("cleans the agent name and skips rows with a bad timestamp", async () => {
    entries = [
      row("1", "sb-1", AgentAccessRequestStatus.Shared, "1000", { agentName: "a‮b\u0000c" }),
      row("2", "sb-1", AgentAccessRequestStatus.Shared, "nope"),
      row("3", "sb-1", AgentAccessRequestStatus.Shared, "500", { agentName: undefined }),
    ];
    const result = await service.listActivity({ sandboxId: "sb-1" });
    expect(result.data.map((e) => [e.id, e.agentName])).toEqual([
      ["1", "abc"],
      ["3", null],
    ]);
  });

  it("caps the list at 200 events", async () => {
    entries = Array.from({ length: 250 }, (_, i) =>
      row(`${i}`, "sb-1", AgentAccessRequestStatus.Shared, `${1000 + i}`),
    );
    expect((await service.listActivity({ sandboxId: "sb-1" })).data).toHaveLength(200);
  });

  it("never throws: a failing source is `failed`", async () => {
    const s = new OpenShellActivityService(
      mock<LogService>(),
      async () => true,
      () => {
        throw new Error("boom");
      },
    );
    expect(await s.listActivity({ sandboxId: "sb-1" })).toEqual({ ok: false, error: "failed" });
  });
});
