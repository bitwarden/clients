import { Source } from "@bitwarden/sdk-internal";

import { AgentFillBrowserRegistry } from "./agent-fill-browser-registry";

const source = (clientId: number) =>
  ({ BrowserBackground: { id: { Id: clientId } } }) as unknown as Source;
const hello = (agentFillAllowed: boolean) => ({
  browser: "chrome",
  extensionVersion: "2026.10.0",
  activeUserId: "user-1",
  accounts: [{ userId: "user-1", agentFillAllowed }],
});

describe("AgentFillBrowserRegistry", () => {
  let registry: AgentFillBrowserRegistry;

  beforeEach(() => {
    registry = new AgentFillBrowserRegistry();
  });

  it("registers a browser on its first Hello and keeps only the latest one", () => {
    expect(registry.list()).toEqual([]);

    expect(registry.hello(source(1), hello(false))).toBe(1);
    expect(registry.allowedFor("user-1")).toEqual([]);

    registry.hello(source(1), hello(true));
    expect(registry.allowedFor("user-1")).toEqual([1]);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0].hello.extensionVersion).toBe("2026.10.0");
  });

  it("prunes a connection and its Hello on disconnect", () => {
    registry.hello(source(1), hello(true));

    expect(registry.remove(1)).toBe(true);
    expect(registry.list()).toEqual([]);
    expect(registry.allowedFor("user-1")).toEqual([]);
    expect(registry.remove(1)).toBe(false);
  });

  it("ignores a Hello from a non-browser source or without a payload", () => {
    expect(registry.hello("DesktopRenderer" as Source, hello(true))).toBeNull();
    expect(registry.hello({ Cli: { id: { Id: 3 } } } as unknown as Source, hello(true))).toBeNull();
    expect(registry.hello(source(1), null)).toBeNull();
    expect(registry.list()).toEqual([]);
  });

  it("treats anything but a literal true as not allowed", () => {
    registry.hello(source(1), {
      ...hello(true),
      accounts: [{ userId: "user-1", agentFillAllowed: "yes" as unknown as boolean }],
    });

    expect(registry.allowedFor("user-1")).toEqual([]);
  });
});
