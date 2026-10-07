import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  cleanOpenShellSavedPorts,
  OpenShellSavedPortsFs,
  OpenShellSavedPortsService,
} from "./openshell-saved-ports.service";

function fakeFs(initial: string | null = null) {
  const state = { content: initial };
  const adapter: OpenShellSavedPortsFs = {
    read: jest.fn(async () => state.content),
    writeAtomic: jest.fn(async (_path: string, content: string) => {
      state.content = content;
    }),
  };
  return { adapter, state };
}

describe("cleanOpenShellSavedPorts", () => {
  it("keeps valid ports, drops duplicates and invalid entries, cleans names", () => {
    const cleaned = cleanOpenShellSavedPorts([
      { port: 8080, name: "  We‮b​ vault\n " },
      { port: 8080, name: "dup" },
      { port: 0, name: "zero" },
      { port: 70000 },
      { port: "80" },
      null,
      "x",
      { port: 3000 },
      { port: 4000, name: "x".repeat(100) },
    ]);
    expect(cleaned).toEqual([
      { port: 8080, name: "Web vault" },
      { port: 3000, name: "" },
      { port: 4000, name: "x".repeat(40) },
    ]);
  });

  it("caps the list and ignores a non-array", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ port: 1000 + i }));
    expect(cleanOpenShellSavedPorts(many)).toHaveLength(20);
    expect(cleanOpenShellSavedPorts("nope")).toEqual([]);
  });
});

describe("OpenShellSavedPortsService", () => {
  let log: ReturnType<typeof mock<LogService>>;
  beforeEach(() => {
    log = mock<LogService>();
  });

  it("stores ports per gateway and sandbox and never mixes them", async () => {
    const { adapter, state } = fakeFs();
    const service = new OpenShellSavedPortsService(log, "/data", adapter);
    await service.set("work", "box", [{ port: 8080, name: "Web" }]);
    await service.set("home", "box", [{ port: 9090, name: "API" }]);
    expect(await service.get("work", "box")).toEqual([{ port: 8080, name: "Web" }]);
    expect(await service.get("home", "box")).toEqual([{ port: 9090, name: "API" }]);
    expect(await service.get("work", "other")).toEqual([]);
    expect(adapter.writeAtomic).toHaveBeenCalledWith(
      "/data/openshell-saved-ports.json",
      expect.any(String),
    );
    // Ports and names only.
    expect(Object.keys(JSON.parse(state.content!).entries[0]).sort()).toEqual([
      "gatewayName",
      "ports",
      "sandboxName",
    ]);
  });

  it("replaces the list and drops the entry when set to empty", async () => {
    const { adapter } = fakeFs();
    const service = new OpenShellSavedPortsService(log, "/data", adapter);
    await service.set("work", "box", [{ port: 1 }, { port: 2 }]);
    await service.set("work", "box", [{ port: 2 }]);
    expect((await service.get("work", "box")).map((p) => p.port)).toEqual([2]);
    await service.set("work", "box", []);
    expect(await service.get("work", "box")).toEqual([]);
  });

  it("loads an existing file, cleaning what it reads", async () => {
    const { adapter } = fakeFs(
      JSON.stringify({
        version: 1,
        entries: [
          {
            gatewayName: "work",
            sandboxName: "box",
            ports: [{ port: 80, name: "a‮b" }, { port: 0 }],
          },
          { gatewayName: "bad name", sandboxName: "box", ports: [{ port: 81 }] },
          { gatewayName: "work", sandboxName: "empty", ports: [] },
        ],
      }),
    );
    const service = new OpenShellSavedPortsService(log, "/data", adapter);
    expect(await service.get("work", "box")).toEqual([{ port: 80, name: "ab" }]);
    expect(await service.get("work", "empty")).toEqual([]);
  });

  it("treats a corrupt file as empty with a warning", async () => {
    const { adapter } = fakeFs("{not json");
    const service = new OpenShellSavedPortsService(log, "/data", adapter);
    expect(await service.get("work", "box")).toEqual([]);
    expect(log.warning).toHaveBeenCalled();
  });

  it("rejects invalid gateway or sandbox names without touching the file", async () => {
    const { adapter } = fakeFs();
    const service = new OpenShellSavedPortsService(log, "/data", adapter);
    expect(await service.set("-x", "box", [{ port: 1 }])).toBeNull();
    expect(await service.set("work", "a b", [{ port: 1 }])).toBeNull();
    expect(await service.get("work", "../x")).toEqual([]);
    expect(adapter.writeAtomic).not.toHaveBeenCalled();
  });

  it("reports a failed write and keeps the previous view", async () => {
    const { adapter } = fakeFs();
    const service = new OpenShellSavedPortsService(log, "/data", adapter);
    await service.set("work", "box", [{ port: 1 }]);
    (adapter.writeAtomic as jest.Mock).mockRejectedValueOnce(new Error("disk"));
    expect(await service.set("work", "box", [{ port: 2 }])).toBeNull();
    expect((await service.get("work", "box")).map((p) => p.port)).toEqual([1]);
  });
});
