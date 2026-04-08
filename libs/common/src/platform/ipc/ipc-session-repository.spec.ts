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
    const result = await repository.get({ BrowserBackground: { id: "Own" } });

    expect(result).toBeUndefined();
  });

  it("saves and retrieves a session", async () => {
    const session = { some: "data" };
    await repository.save({ BrowserBackground: { id: "Own" } }, session);

    const result = await repository.get({ BrowserBackground: { id: "Own" } });

    expect(result).toEqual(session);
  });

  it("saves and retrieves a web session", async () => {
    const session = { some: "data" };
    await repository.save({ Web: { tab_id: 9001, document_id: "doc-abc-123" } }, session);

    const result = await repository.get({ Web: { tab_id: 9001, document_id: "doc-abc-123" } });

    expect(result).toEqual(session);
  });

  it("removes a session", async () => {
    const session = { some: "data" };
    await repository.save({ BrowserBackground: { id: "Own" } }, session);

    await repository.remove({ BrowserBackground: { id: "Own" } });
    const result = await repository.get({ BrowserBackground: { id: "Own" } });

    expect(result).toBeUndefined();
  });
});
