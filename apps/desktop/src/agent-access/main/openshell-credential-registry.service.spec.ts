import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  OpenShellCredentialRegistryFs,
  OpenShellCredentialRegistryService,
  OpenShellRegistryEntry,
} from "./openshell-credential-registry.service";

const FILE = "/data/openshell-credentials.json";
const ITEM_ID = "0b6f5d1e-3c2a-4d7e-9f10-aa11bb22cc33";
const SECRET_ID = "1c7a6e2f-4d3b-4e8f-8a21-bb22cc33dd44";

function entry(overrides: Partial<OpenShellRegistryEntry> = {}): OpenShellRegistryEntry {
  return {
    gatewayName: "work",
    sandboxName: "box",
    providerName: "github-box",
    profileId: "github",
    bindings: [
      { envVar: "GH_TOKEN", resourceType: "secret", id: SECRET_ID, field: "value", label: "GH" },
    ],
    createdAtMs: 1000,
    ...overrides,
  };
}

function fakeFs(initial: string | null = null) {
  const state = { content: initial };
  const writes: { path: string; content: string }[] = [];
  const adapter: OpenShellCredentialRegistryFs = {
    read: jest.fn(async () => state.content),
    writeAtomic: jest.fn(async (filePath: string, content: string) => {
      writes.push({ path: filePath, content });
      state.content = content;
    }),
  };
  return { adapter, writes, state };
}

describe("OpenShellCredentialRegistryService", () => {
  let log: ReturnType<typeof mock<LogService>>;

  beforeEach(() => {
    log = mock<LogService>();
  });

  const create = (fs: OpenShellCredentialRegistryFs) =>
    new OpenShellCredentialRegistryService(log, "/data", fs);

  it("starts empty when the file does not exist", async () => {
    const { adapter } = fakeFs(null);
    const registry = create(adapter);
    expect(await registry.getForSandbox("work", "box")).toEqual([]);
    expect(await registry.isManaged("work", "box", "github-box")).toBe(false);
    expect(log.warning).not.toHaveBeenCalled();
  });

  it("persists an upsert atomically to <userData>/openshell-credentials.json", async () => {
    const { adapter, writes } = fakeFs(null);
    const registry = create(adapter);
    expect(await registry.upsert(entry())).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe(FILE);
    expect(JSON.parse(writes[0].content)).toEqual({ version: 1, entries: [entry()] });
    expect(await registry.isManaged("work", "box", "github-box")).toBe(true);
    expect(await registry.isManaged("work", "other", "github-box")).toBe(false);
  });

  it("stores only ids and names: no bw:// reference and no value", async () => {
    const { adapter, writes } = fakeFs(null);
    await create(adapter).upsert(entry());
    expect(writes[0].content).not.toContain("bw://");
  });

  it("replaces an existing entry for the same sandbox and provider", async () => {
    const { adapter } = fakeFs(null);
    const registry = create(adapter);
    await registry.upsert(entry({ createdAtMs: 1 }));
    await registry.upsert(entry({ createdAtMs: 2 }));
    const found = await registry.getForSandbox("work", "box");
    expect(found).toHaveLength(1);
    expect(found[0].createdAtMs).toBe(2);
  });

  it("reads back what an earlier instance wrote", async () => {
    const { adapter } = fakeFs(null);
    await create(adapter).upsert(entry());
    expect(await create(adapter).getForSandbox("work", "box")).toEqual([entry()]);
  });

  it("returns copies, so a caller cannot change the stored record", async () => {
    const { adapter } = fakeFs(null);
    const registry = create(adapter);
    await registry.upsert(entry());
    (await registry.getForSandbox("work", "box"))[0].bindings[0].label = "changed";
    expect((await registry.getForSandbox("work", "box"))[0].bindings[0].label).toBe("GH");
  });

  it("removes one provider, or every entry of a sandbox", async () => {
    const { adapter } = fakeFs(null);
    const registry = create(adapter);
    await registry.upsert(entry());
    await registry.upsert(entry({ providerName: "second" }));
    await registry.upsert(entry({ sandboxName: "other" }));

    await registry.removeProvider("work", "box", "github-box");
    expect((await registry.getForSandbox("work", "box")).map((e) => e.providerName)).toEqual([
      "second",
    ]);

    await registry.removeSandbox("work", "box");
    expect(await registry.getForSandbox("work", "box")).toEqual([]);
    expect(await registry.getForSandbox("work", "other")).toHaveLength(1);
  });

  it("does not write when a removal changes nothing", async () => {
    const { adapter, writes } = fakeFs(null);
    const registry = create(adapter);
    expect(await registry.removeSandbox("work", "nope")).toBe(true);
    expect(writes).toHaveLength(0);
  });

  it("treats a corrupt file as empty with a warning, and never throws", async () => {
    const { adapter } = fakeFs("{not json");
    const registry = create(adapter);
    expect(await registry.getForSandbox("work", "box")).toEqual([]);
    expect(log.warning).toHaveBeenCalledTimes(1);
  });

  it("treats a wrong-shaped file as empty", async () => {
    const { adapter } = fakeFs(JSON.stringify({ entries: "nope" }));
    expect(await create(adapter).getForSandbox("work", "box")).toEqual([]);
    expect(log.warning).toHaveBeenCalled();
  });

  it("treats a read failure (for example an oversized file) as empty", async () => {
    const adapter: OpenShellCredentialRegistryFs = {
      read: jest.fn(async () => {
        throw new Error("too big");
      }),
      writeAtomic: jest.fn(),
    };
    expect(await create(adapter).isManaged("work", "box", "x")).toBe(false);
    expect(log.warning).toHaveBeenCalled();
  });

  it("passes the size guard to the filesystem adapter", async () => {
    const { adapter } = fakeFs(null);
    await create(adapter).getForSandbox("work", "box");
    expect(adapter.read).toHaveBeenCalledWith(FILE, 1024 * 1024);
  });

  it("drops entries that fail validation and keeps the good ones", async () => {
    const good = entry();
    const content = JSON.stringify({
      version: 1,
      entries: [
        good,
        entry({ sandboxName: "-bad" }),
        entry({ providerName: "a;b" }),
        entry({
          bindings: [
            { envVar: "lower", resourceType: "secret", id: SECRET_ID, field: "value", label: "x" },
          ],
        }),
        entry({
          bindings: [
            { envVar: "A", resourceType: "item", id: ITEM_ID, field: "value", label: "x" },
          ],
        }),
        entry({ createdAtMs: "soon" as unknown as number }),
        "junk",
        null,
      ],
    });
    const { adapter } = fakeFs(content);
    const found = await create(adapter).getForSandbox("work", "box");
    expect(found).toEqual([good]);
  });

  it("reports false and keeps its view when a write fails", async () => {
    const adapter: OpenShellCredentialRegistryFs = {
      read: jest.fn(async () => null),
      writeAtomic: jest.fn(async () => {
        throw new Error("disk full");
      }),
    };
    const registry = create(adapter);
    expect(await registry.upsert(entry())).toBe(false);
    expect(await registry.isManaged("work", "box", "github-box")).toBe(false);
    expect(log.warning).toHaveBeenCalled();
  });

  it("serializes concurrent writes so none is lost", async () => {
    const { adapter } = fakeFs(null);
    const registry = create(adapter);
    await Promise.all([
      registry.upsert(entry({ providerName: "a" })),
      registry.upsert(entry({ providerName: "b" })),
      registry.upsert(entry({ providerName: "c" })),
    ]);
    expect((await registry.getForSandbox("work", "box")).map((e) => e.providerName).sort()).toEqual(
      ["a", "b", "c"],
    );
  });

  describe("gateway scoping", () => {
    it("matches only the gateway the entry was recorded on", async () => {
      const { adapter } = fakeFs(null);
      const registry = create(adapter);
      await registry.upsert(entry());
      expect(await registry.isManaged("work", "box", "github-box")).toBe(true);
      expect(await registry.isManaged("home", "box", "github-box")).toBe(false);
      expect(await registry.getForSandbox("home", "box")).toEqual([]);
    });

    it("keeps the same names on two gateways apart", async () => {
      const { adapter } = fakeFs(null);
      const registry = create(adapter);
      await registry.upsert(entry({ gatewayName: "work" }));
      await registry.upsert(entry({ gatewayName: "home" }));
      await registry.removeProvider("home", "box", "github-box");
      expect(await registry.isManaged("work", "box", "github-box")).toBe(true);
      expect(await registry.isManaged("home", "box", "github-box")).toBe(false);
      await registry.removeSandbox("other", "box");
      expect(await registry.isManaged("work", "box", "github-box")).toBe(true);
    });

    it("loads an entry without a gateway as unmanaged for every gateway", async () => {
      const legacy = { ...entry() } as Partial<OpenShellRegistryEntry>;
      delete legacy.gatewayName;
      const { adapter } = fakeFs(JSON.stringify({ version: 1, entries: [legacy] }));
      const registry = create(adapter);
      expect(await registry.isManaged("work", "box", "github-box")).toBe(false);
      expect(await registry.isManaged("", "box", "github-box")).toBe(false);
      expect(await registry.getForSandbox("work", "box")).toEqual([]);
    });

    it("refuses to record an entry without a valid gateway", async () => {
      const { adapter, writes } = fakeFs(null);
      expect(await create(adapter).upsert(entry({ gatewayName: "" }))).toBe(false);
      expect(writes).toHaveLength(0);
    });
  });

  describe("labels", () => {
    const hostile = "a\u202Eb\u200Bc\u2066d\uFEFFe\u0007f";

    it("strips bidi and zero-width characters when loading", async () => {
      const content = JSON.stringify({
        version: 1,
        entries: [
          entry({
            bindings: [
              {
                envVar: "GH_TOKEN",
                resourceType: "secret",
                id: SECRET_ID,
                field: "value",
                label: hostile,
              },
            ],
          }),
        ],
      });
      const { adapter } = fakeFs(content);
      const found = await create(adapter).getForSandbox("work", "box");
      expect(found[0].bindings[0].label).toBe("abcdef");
    });

    it("strips them when storing", async () => {
      const { adapter, writes } = fakeFs(null);
      await create(adapter).upsert(
        entry({
          bindings: [
            {
              envVar: "GH_TOKEN",
              resourceType: "secret",
              id: SECRET_ID,
              field: "value",
              label: hostile,
            },
          ],
        }),
      );
      expect(JSON.parse(writes[0].content).entries[0].bindings[0].label).toBe("abcdef");
    });
  });
});
