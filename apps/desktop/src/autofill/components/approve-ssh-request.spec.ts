import { RequestContext } from "../models/ssh-request-context";

import { ApproveSshRequestParams, buildProseParts } from "./approve-ssh-request";

function ctxFixture(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    app: {
      processName: "ssh",
      executablePath: "/usr/bin/ssh",
      pid: 1234,
      parentChain: [
        { pid: 1, name: "init", executablePath: "/sbin/init" },
        { pid: 1234, name: "ssh", executablePath: "/usr/bin/ssh" },
      ],
      argv: ["/usr/bin/ssh", "user@example.com"],
      ...(overrides.app ?? {}),
    },
    host: {
      source: "none",
      hostname: null,
      hostnameUnverified: null,
      port: null,
      username: null,
      keyFingerprint: null,
      knownHostsMatch: false,
      ...(overrides.host ?? {}),
    },
  };
}

function params(ctx: RequestContext | null): ApproveSshRequestParams {
  return {
    cipherName: "My Key",
    applicationName: "ssh",
    isAgentForwarding: false,
    action: "sshActionLogin",
    context: ctx,
  };
}

describe("buildProseParts", () => {
  it("returns host clause with username when both present", () => {
    const out = buildProseParts(
      params(
        ctxFixture({
          host: {
            source: "known-hosts",
            hostname: "github.com",
            hostnameUnverified: null,
            port: null,
            username: "git",
            keyFingerprint: "SHA256:abc",
            knownHostsMatch: true,
          },
        }),
      ),
    );
    expect(out.hostClause).toBe("git@github.com");
    expect(out.showVerifiedBadge).toBe(true);
    expect(out.showUnverifiedBadge).toBe(false);
  });

  it("returns bare hostname when no username", () => {
    const out = buildProseParts(
      params(
        ctxFixture({
          host: {
            source: "known-hosts",
            hostname: "github.com",
            hostnameUnverified: null,
            port: null,
            username: null,
            keyFingerprint: "SHA256:abc",
            knownHostsMatch: true,
          },
        }),
      ),
    );
    expect(out.hostClause).toBe("github.com");
  });

  it("marks argv-sourced hostnames as unverified", () => {
    const out = buildProseParts(
      params(
        ctxFixture({
          host: {
            source: "argv",
            hostname: "example.com",
            hostnameUnverified: null,
            port: null,
            username: null,
            keyFingerprint: null,
            knownHostsMatch: false,
          },
        }),
      ),
    );
    expect(out.showUnverifiedBadge).toBe(true);
    expect(out.showVerifiedBadge).toBe(false);
  });

  it("omits host clause when no hostname", () => {
    const out = buildProseParts(params(ctxFixture()));
    expect(out.hostClause).toBeNull();
    expect(out.showVerifiedBadge).toBe(false);
    expect(out.showUnverifiedBadge).toBe(false);
  });

  it("applies friendly-name lookup for known apps", () => {
    const out = buildProseParts(
      params(
        ctxFixture({
          app: {
            processName: "Code",
            executablePath: "/Applications/Visual Studio Code.app/Contents/MacOS/Code",
            pid: 1,
            parentChain: [],
            argv: null,
          },
        }),
      ),
    );
    expect(out.subject).toBe("Visual Studio Code");
  });

  it("skips noise processes when picking a parent", () => {
    const out = buildProseParts(
      params(
        ctxFixture({
          app: {
            processName: "ssh",
            executablePath: null,
            pid: 4,
            parentChain: [
              { pid: 1, name: "init", executablePath: null },
              { pid: 2, name: "bash", executablePath: null },
              { pid: 3, name: "Code", executablePath: null },
              { pid: 4, name: "ssh", executablePath: null },
            ],
            argv: null,
          },
        }),
      ),
    );
    expect(out.parent).toBe("Visual Studio Code");
  });

  it("returns null parent when all ancestors are noise", () => {
    const out = buildProseParts(
      params(
        ctxFixture({
          app: {
            processName: "ssh",
            executablePath: null,
            pid: 3,
            parentChain: [
              { pid: 1, name: "init", executablePath: null },
              { pid: 2, name: "bash", executablePath: null },
              { pid: 3, name: "ssh", executablePath: null },
            ],
            argv: null,
          },
        }),
      ),
    );
    expect(out.parent).toBeNull();
  });

  it("falls back to applicationName when context is null", () => {
    const out = buildProseParts(params(null));
    expect(out.subject).toBe("ssh");
    expect(out.hostClause).toBeNull();
  });
});
