import { findOpenShellPermissionUsage } from "./openshell-permission-usage.util";

const credential = (profileId: string | null) => ({
  providerName: "p",
  profileId,
  bindings: [],
  managed: true,
});

describe("findOpenShellPermissionUsage", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let originalIpc: unknown;
  let byName: Record<string, unknown>;

  beforeEach(() => {
    byName = {
      a: { ok: true, data: [credential("github"), credential("github"), credential(null)] },
      b: { ok: true, data: [credential("github"), credential("aws")] },
    };
    agentAccessIpc = {
      listOpenShellSandboxes: jest
        .fn()
        .mockResolvedValue({ ok: true, data: [{ name: "a" }, { name: "b" }] }),
      listOpenShellCredentials: jest
        .fn()
        .mockImplementation(
          async ({ sandboxName }: { sandboxName: string }) => byName[sandboxName],
        ),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
  });

  it("maps each permission to the sandboxes that use it, once per sandbox", async () => {
    const usage = await findOpenShellPermissionUsage();

    expect(usage?.complete).toBe(true);
    expect(usage?.sandboxesByProfile.get("github")).toEqual(["a", "b"]);
    expect(usage?.sandboxesByProfile.get("aws")).toEqual(["b"]);
    expect(usage?.sandboxesByProfile.has("null")).toBe(false);
  });

  it("is null when the sandbox list can't be read", async () => {
    agentAccessIpc.listOpenShellSandboxes.mockResolvedValue({ ok: false, error: "failed" });

    expect(await findOpenShellPermissionUsage()).toBeNull();
  });

  it("is incomplete when one sandbox can't be read, and still reports the rest", async () => {
    byName["b"] = { ok: false, error: "failed" };

    const usage = await findOpenShellPermissionUsage();

    expect(usage?.complete).toBe(false);
    expect(usage?.sandboxesByProfile.get("github")).toEqual(["a"]);
  });

  it("looks at no more than 50 sandboxes and says the answer is incomplete", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ name: `s${i}` }));
    agentAccessIpc.listOpenShellSandboxes.mockResolvedValue({ ok: true, data: many });
    agentAccessIpc.listOpenShellCredentials.mockResolvedValue({ ok: true, data: [] });

    const usage = await findOpenShellPermissionUsage();

    expect(agentAccessIpc.listOpenShellCredentials).toHaveBeenCalledTimes(50);
    expect(usage?.complete).toBe(false);
  });
});
