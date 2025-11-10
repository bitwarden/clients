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
});
