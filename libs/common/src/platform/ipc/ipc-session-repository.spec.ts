import { FakeActiveUserAccessor, FakeStateProvider } from "../../../spec";
import { UserId } from "../../types/guid";

import { IpcSessionRepository } from "./ipc-session-repository";

describe("IpcSessionRepository", () => {
  const userId = "user-id" as UserId;
  let stateProvider!: FakeStateProvider;
  let repository!: IpcSessionRepository;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(new FakeActiveUserAccessor(userId));
    repository = new IpcSessionRepository(stateProvider);
  });

  it("returns undefined when empty", async () => {
    const result = await repository.get("BrowserBackground");

    expect(result).toBeUndefined();
  });

  it("saves and retrieves a session", async () => {
    const session = { some: "data" };
    await repository.save("BrowserBackground", session);

    const result = await repository.get("BrowserBackground");

    expect(result).toEqual(session);
  });

  it("removes a session", async () => {
    const session = { some: "data" };
    await repository.save("BrowserBackground", session);

    await repository.remove("BrowserBackground");
    const result = await repository.get("BrowserBackground");

    expect(result).toBeUndefined();
  });

  it("converts Web endpoint object to string key", async () => {
    const session = { web: true };
    await repository.save({ Web: { id: 123 } }, session);
    const result = await repository.get({ Web: { id: 123 } });
    expect(result).toEqual(session);
  });

  it("stores multiple sessions independently", async () => {
    const sessionA = { a: 1 };
    const sessionB = { b: 2 };
    await repository.save("BrowserBackground", sessionA);
    await repository.save({ Web: 123 } as any, sessionB);
    const resultA = await repository.get("BrowserBackground");
    const resultB = await repository.get({ Web: 123 } as any);
    expect(resultA).toEqual(sessionA);
    expect(resultB).toEqual(sessionB);
  });

  it("removing non-existent session does not throw and keeps others intact", async () => {
    const sessionA = { a: 1 };
    await repository.save("BrowserBackground", sessionA);
    await expect(repository.remove("BrowserForeground")).resolves.toBeUndefined();
    const resultA = await repository.get("BrowserBackground");
    expect(resultA).toEqual(sessionA);
  });

  it("saves null session value", async () => {
    await repository.save("BrowserBackground", null);
    const result = await repository.get("BrowserBackground");
    expect(result).toBeNull();
  });

  it("saves undefined session value (explicit)", async () => {
    await repository.save("BrowserBackground", undefined);
    const result = await repository.get("BrowserBackground");
    expect(result).toBeUndefined();
  });
});
