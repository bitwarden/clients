import { InMemoryIpcSessionRepository } from "./in-memory-ipc-session-repository";

describe("InMemoryIpcSessionRepository", () => {
  let repository: InMemoryIpcSessionRepository;

  beforeEach(() => {
    repository = new InMemoryIpcSessionRepository();
  });

  it("returns undefined when empty", async () => {
    expect(await repository.get({ BrowserBackground: { id: "Own" } })).toBeUndefined();
  });

  it("saves and retrieves a session per endpoint", async () => {
    await repository.save({ BrowserForeground: { id: 1 } }, { some: "one" });
    await repository.save({ BrowserForeground: { id: 2 } }, { some: "two" });

    expect(await repository.get({ BrowserForeground: { id: 1 } })).toEqual({ some: "one" });
    expect(await repository.get({ BrowserForeground: { id: 2 } })).toEqual({ some: "two" });
  });

  it("removes only the given endpoint's session", async () => {
    await repository.save({ BrowserForeground: { id: 1 } }, { some: "one" });
    await repository.save({ BrowserForeground: { id: 2 } }, { some: "two" });

    await repository.remove({ BrowserForeground: { id: 1 } });

    expect(await repository.get({ BrowserForeground: { id: 1 } })).toBeUndefined();
    expect(await repository.get({ BrowserForeground: { id: 2 } })).toEqual({ some: "two" });
  });
});
