import { AgentFillBrowserRegistry } from "./agent-fill-browser-registry";

const source = (clientId: number) => ({ BrowserBackground: { id: { Id: clientId } } }) as any;
const hello = (agentFillAllowed: boolean) => ({
  browser: "chrome",
  extensionVersion: "2026.10.0",
  activeUserId: "user-1",
  accounts: [{ userId: "user-1", agentFillAllowed }],
});

describe("AgentFillBrowserRegistry (prototype)", () => {
  let registry: AgentFillBrowserRegistry;

  beforeEach(() => {
    registry = new AgentFillBrowserRegistry();
  });

  it("tracks connections and keeps only the latest Hello", () => {
    expect(registry.seen(1)).toBe(true);
    expect(registry.seen(1)).toBe(false);
    expect(registry.list()).toEqual([{ clientId: 1, hello: null }]);

    registry.hello(source(1), hello(false));
    expect(registry.allowedFor("user-1")).toEqual([]);

    registry.hello(source(1), hello(true));
    expect(registry.allowedFor("user-1")).toEqual([1]);
    expect(registry.list()[0].hello?.extensionVersion).toBe("2026.10.0");
  });

  it("prunes a connection and its Hello on disconnect", () => {
    registry.seen(1);
    registry.hello(source(1), hello(true));

    expect(registry.remove(1)).toBe(true);
    expect(registry.list()).toEqual([]);
    expect(registry.allowedFor("user-1")).toEqual([]);
    expect(registry.remove(1)).toBe(false);
  });

  it("ignores a Hello from an unknown connection or a non-browser source", () => {
    registry.seen(1);

    expect(registry.hello(source(2), hello(true))).toBeNull();
    expect(registry.hello("DesktopRenderer", hello(true))).toBeNull();
    expect(registry.allowedFor("user-1")).toEqual([]);
  });

  it("treats anything but a literal true as not allowed", () => {
    registry.seen(1);
    registry.hello(source(1), {
      ...hello(true),
      accounts: [{ userId: "user-1", agentFillAllowed: "yes" as unknown as boolean }],
    });

    expect(registry.allowedFor("user-1")).toEqual([]);
  });
});
