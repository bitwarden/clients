import { createHash } from "crypto";

import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { AGENT_FILL_IPC_CHANNELS } from "../models/ipc-channels";

import {
  AGENT_FILL_CONNECTIONS,
  AgentFillConnectionsService,
} from "./agent-fill-connections.service";

const ipcHandlers = new Map<string, (...args: any[]) => any>();

jest.mock("electron", () => ({
  ipcMain: { handle: (channel: string, fn: any) => ipcHandlers.set(channel, fn) },
}));

describe("AgentFillConnectionsService", () => {
  let stateProvider: FakeStateProvider;
  let service: AgentFillConnectionsService;

  beforeEach(() => {
    ipcHandlers.clear();
    stateProvider = new FakeStateProvider(mockAccountServiceWith("user-1" as UserId));
    service = new AgentFillConnectionsService(stateProvider);
  });

  it("starts empty", async () => {
    expect(await service.list()).toEqual([]);
  });

  describe("create", () => {
    it("returns a 43-character base64url key once and lists the connection without it", async () => {
      const { connection, key } = await service.create("Claude Desktop");

      expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(connection).toMatchObject({ name: "Claude Desktop", paused: false });
      const listed = await service.list();
      expect(listed).toEqual([connection]);
      expect(JSON.stringify(listed)).not.toContain(key);
    });

    it("saves only the SHA-256 hash of the key", async () => {
      const { key } = await service.create("Claude Desktop");

      const stored = JSON.stringify(
        await firstValueFrom(stateProvider.global.getFake(AGENT_FILL_CONNECTIONS).state$),
      );
      expect(stored).not.toContain(key);
      expect(stored).toContain(createHash("sha256").update(key).digest("hex"));
    });

    it("generates a different key each time", async () => {
      const first = await service.create("One");
      const second = await service.create("Two");

      expect(first.key).not.toEqual(second.key);
    });

    it("trims the name", async () => {
      const { connection } = await service.create("  Claude Desktop  ");

      expect(connection.name).toBe("Claude Desktop");
    });

    it.each([
      ["", "empty"],
      ["   ", "blank"],
      [undefined, "missing"],
      ["a".repeat(51), "too long"],
    ])("rejects a name that is %s (%s)", async (name) => {
      await expect(service.create(name)).rejects.toThrow();
      expect(await service.list()).toEqual([]);
    });
  });

  describe("findByKey", () => {
    it("finds the connection the key belongs to", async () => {
      await service.create("One");
      const second = await service.create("Two");

      expect(await service.findByKey(second.key)).toEqual(second.connection);
    });

    it.each([[""], ["not-a-key"], [undefined], [42]])("returns null for %p", async (key) => {
      await service.create("One");

      expect(await service.findByKey(key)).toBeNull();
    });

    it("returns null once the connection is removed", async () => {
      const { connection, key } = await service.create("One");
      await service.remove(connection.id);

      expect(await service.findByKey(key)).toBeNull();
    });

    it("still finds a paused connection so the hub can say it is paused", async () => {
      const { connection, key } = await service.create("One");
      await service.setPaused(connection.id, true);

      expect(await service.findByKey(key)).toMatchObject({ id: connection.id, paused: true });
    });
  });

  it("pauses and resumes only the chosen connection", async () => {
    const one = await service.create("One");
    const two = await service.create("Two");

    await service.setPaused(one.connection.id, true);
    expect((await service.list()).map((c) => c.paused)).toEqual([true, false]);

    await service.setPaused(one.connection.id, false);
    expect((await service.list()).map((c) => c.paused)).toEqual([false, false]);
    expect(await service.get(two.connection.id)).toEqual(two.connection);
  });

  it("removes only the chosen connection", async () => {
    const one = await service.create("One");
    const two = await service.create("Two");

    await service.remove(one.connection.id);

    expect(await service.list()).toEqual([two.connection]);
  });

  it("serves the renderer through the connections channels", async () => {
    const created = await ipcHandlers.get(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_CREATE)!({}, "Work");
    const id = created.connection.id;

    await ipcHandlers.get(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_PAUSE)!({}, id);
    expect(await ipcHandlers.get(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_LIST)!({})).toEqual([
      expect.objectContaining({ id, paused: true }),
    ]);

    await ipcHandlers.get(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_RESUME)!({}, id);
    await ipcHandlers.get(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_REMOVE)!({}, id);
    expect(await ipcHandlers.get(AGENT_FILL_IPC_CHANNELS.CONNECTIONS_LIST)!({})).toEqual([]);
  });
});
