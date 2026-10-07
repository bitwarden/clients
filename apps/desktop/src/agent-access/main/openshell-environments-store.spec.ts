import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  OpenShellEnvironmentsStore,
  OpenShellEnvironmentsStoreFs,
} from "./openshell-environments-store";

const SET_ID = "0b6f5d1e-3c2a-4d7e-9f10-aa11bb22cc33";
const SECRET = "1c7a6e2f-4d3b-4e8f-8a21-bb22cc33dd44";
const REF = {
  resourceType: "secret",
  id: SECRET,
  field: "value",
  label: "GH",
  profileId: "github",
  envVar: "GH_TOKEN",
};

function fakeFs(initial: string | null = null, failWrites = false) {
  const state = { content: initial };
  const writes: { path: string; content: string }[] = [];
  const adapter: OpenShellEnvironmentsStoreFs = {
    read: jest.fn(async () => state.content),
    writeAtomic: jest.fn(async (filePath: string, content: string) => {
      if (failWrites) {
        throw new Error("disk full");
      }
      writes.push({ path: filePath, content });
      state.content = content;
    }),
  };
  return { adapter, writes, state };
}

describe("OpenShellEnvironmentsStore", () => {
  let log: ReturnType<typeof mock<LogService>>;
  beforeEach(() => {
    log = mock<LogService>();
  });
  const create = (fs: OpenShellEnvironmentsStoreFs) =>
    new OpenShellEnvironmentsStore(log, "/data", fs);

  it("is empty when the file does not exist and writes to <userData>/openshell-environments.json", async () => {
    const { adapter, writes } = fakeFs(null);
    const store = create(adapter);
    expect(await store.read("work")).toEqual({ environments: [], secretSets: [], sandboxMeta: {} });
    expect(
      await store.update("work", (d) => {
        d.sandboxMeta["box"] = { name: "box", purpose: "p", color: "blue" };
        return true;
      }),
    ).toBe("written");
    expect(writes[0].path).toBe("/data/openshell-environments.json");
    expect(JSON.parse(writes[0].content)).toEqual({
      version: 1,
      gateways: {
        work: {
          environments: [],
          secretSets: [],
          sandboxMeta: { box: { name: "box", purpose: "p", color: "blue" } },
        },
      },
    });
  });

  it("keeps gateways apart", async () => {
    const { adapter } = fakeFs(null);
    const store = create(adapter);
    await store.update("work", (d) => {
      d.sandboxMeta["box"] = { name: "box", purpose: "p", color: null };
      return true;
    });
    expect((await store.read("home")).sandboxMeta).toEqual({});
    expect((await store.read("work")).sandboxMeta["box"]).toBeDefined();
  });

  it("does not write when the change declines, and returns copies", async () => {
    const { adapter, writes } = fakeFs(null);
    const store = create(adapter);
    expect(await store.update("work", () => false)).toBe("unchanged");
    expect(writes).toHaveLength(0);
    const copy = await store.read("work");
    copy.sandboxMeta["x"] = { name: "x", purpose: "", color: null };
    expect((await store.read("work")).sandboxMeta).toEqual({});
  });

  it("refuses an invalid gateway name", async () => {
    const { adapter, writes } = fakeFs(null);
    expect(await create(adapter).update("-x", () => true)).toBe("failed");
    expect(writes).toHaveLength(0);
  });

  it("reports a failed write and leaves the view unchanged", async () => {
    const { adapter } = fakeFs(null, true);
    const store = create(adapter);
    expect(
      await store.update("work", (d) => {
        d.sandboxMeta["box"] = { name: "box", purpose: "p", color: null };
        return true;
      }),
    ).toBe("failed");
    expect((await store.read("work")).sandboxMeta).toEqual({});
    expect(log.warning).toHaveBeenCalled();
  });

  it("treats a corrupt file as empty with a warning", async () => {
    const { adapter } = fakeFs("{not json");
    expect(await create(adapter).read("work")).toEqual({
      environments: [],
      secretSets: [],
      sandboxMeta: {},
    });
    expect(log.warning).toHaveBeenCalled();
    const wrongShape = create(fakeFs('{"gateways": []}').adapter);
    await wrongShape.read("work");
    expect(log.warning).toHaveBeenCalledTimes(2);
  });

  it("re-validates every entry on load and drops bad ones, never throwing", async () => {
    const file = {
      version: 1,
      gateways: {
        work: {
          secretSets: [
            { id: SET_ID, name: "  Good ", secrets: [REF] },
            { id: "nope", name: "bad id", secrets: [REF] },
            { id: SET_ID, name: "bad ref", secrets: [{ ...REF, envVar: "PATH" }] },
          ],
          environments: [
            { id: SET_ID, name: "Env", description: "d", from: "../etc" },
            { id: SET_ID, name: "Env2", description: "d", cpu: "2" },
          ],
          sandboxMeta: {
            box: { purpose: "a\nb", color: "blue", extra: 1 },
            "-bad": { purpose: "x", color: null },
            empty: { purpose: "", color: "pink" },
          },
        },
        "-bad": {},
      },
    };
    const store = create(fakeFs(JSON.stringify(file)).adapter);
    const data = await store.read("work");
    expect(data.secretSets).toEqual([{ id: SET_ID, name: "Good", secrets: [REF] }]);
    expect(data.environments).toEqual([{ id: SET_ID, name: "Env2", description: "d", cpu: "2" }]);
    expect(data.sandboxMeta).toEqual({ box: { name: "box", purpose: "a b", color: "blue" } });
    expect(await store.read("-bad")).toEqual({ environments: [], secretSets: [], sandboxMeta: {} });
  });

  it("serialises overlapping updates", async () => {
    const { adapter } = fakeFs(null);
    const store = create(adapter);
    await Promise.all(
      ["a", "b", "c"].map((name) =>
        store.update("work", (d) => {
          d.sandboxMeta[name] = { name, purpose: name, color: null };
          return true;
        }),
      ),
    );
    expect(Object.keys((await store.read("work")).sandboxMeta).sort()).toEqual(["a", "b", "c"]);
  });
});
