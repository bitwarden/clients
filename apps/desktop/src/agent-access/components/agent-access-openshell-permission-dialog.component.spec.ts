import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { OpenShellProviderProfile } from "../models/openshell-management";

import {
  AgentAccessOpenShellPermissionDialogComponent,
  AgentAccessOpenShellPermissionDialogParams,
  defaultPermissionEnvVar,
  slugifyPermissionName,
} from "./agent-access-openshell-permission-dialog.component";

const profile: OpenShellProviderProfile = {
  id: "github",
  displayName: "GitHub",
  description: "Work account",
  credentials: [],
  endpoints: [
    { host: "api.github.com", port: 443, access: "read-only" },
    { host: "github.com", port: 443, access: "read-write" },
  ],
  binaries: ["/usr/bin/curl"],
  editable: true,
};

describe("slugifyPermissionName / defaultPermissionEnvVar", () => {
  it("makes a lowercase id from a name", () => {
    expect(slugifyPermissionName("GitHub (work)")).toBe("github-work");
    expect(slugifyPermissionName("  --Hello__World--  ")).toBe("hello-world");
    expect(slugifyPermissionName("***")).toBe("");
    expect(slugifyPermissionName("a".repeat(80))).toHaveLength(40);
  });

  it("makes a valid env var from a name, or nothing", () => {
    expect(defaultPermissionEnvVar("GitHub (work)")).toBe("GITHUB_WORK_TOKEN");
    expect(defaultPermissionEnvVar("1password")).toBe("_1PASSWORD_TOKEN");
    expect(defaultPermissionEnvVar("***")).toBe("");
  });
});

describe("AgentAccessOpenShellPermissionDialogComponent", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let originalIpc: unknown;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let dialogRef: { close: jest.Mock };

  beforeAll(() => {
    (global as any).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    agentAccessIpc = {
      createOpenShellProfile: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
      updateOpenShellProfile: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
      listOpenShellSandboxes: jest
        .fn()
        .mockResolvedValue({ ok: true, data: [{ name: "alpha" }, { name: "beta" }] }),
      listOpenShellCredentials: jest
        .fn()
        .mockImplementation(async ({ sandboxName }: { sandboxName: string }) => ({
          ok: true,
          data:
            sandboxName === "alpha"
              ? [{ providerName: "p", profileId: "github", bindings: [], managed: true }]
              : [],
        })),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);
    dialogRef = { close: jest.fn() };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  async function render(
    params: AgentAccessOpenShellPermissionDialogParams = {},
  ): Promise<ComponentFixture<AgentAccessOpenShellPermissionDialogComponent>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string, ...args: (string | number)[]) =>
      [key, ...args].join("|"),
    );
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellPermissionDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ValidationService, useValue: mock<ValidationService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
      ],
    });
    // The component's own imports provide a DialogService; the fake has to win there too.
    TestBed.overrideComponent(AgentAccessOpenShellPermissionDialogComponent, {
      add: { providers: [{ provide: DialogService, useValue: dialogService }] },
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellPermissionDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const comp = (f: ComponentFixture<unknown>) => f.componentInstance as any;
  const q = (fixture: ComponentFixture<unknown>, selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
  const text = (fixture: ComponentFixture<unknown>, testId: string) =>
    q(fixture, `[data-testid="${testId}"]`)?.textContent ?? null;
  const submit = async (fixture: ComponentFixture<any>) => {
    await comp(fixture).submit();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Fills a valid new permission. */
  function fillNew(fixture: ComponentFixture<any>) {
    const c = comp(fixture);
    c.setName("GitHub Work");
    const [row] = c.hosts();
    row.host.set("api.github.com");
  }

  describe("creating", () => {
    it("starts with one empty host on port 443, no shared warning and no affected list", async () => {
      const fixture = await render();

      const [row] = comp(fixture).hosts();
      expect(comp(fixture).hosts()).toHaveLength(1);
      expect(row.host()).toBe("");
      expect(row.port()).toBe("443");
      expect(row.access()).toBe("read-only");
      expect(q(fixture, '[data-testid="openshell-permission-shared"]')).toBeNull();
      expect(agentAccessIpc.listOpenShellSandboxes).not.toHaveBeenCalled();
    });

    describe("prefilled from a blocked request (§M8.20 rule 16)", () => {
      it("fills the host, the port, the program and a name from the request", async () => {
        const fixture = await render({
          prefill: { host: "api.stripe.com", port: 8443, program: "/usr/bin/curl" },
        });

        const [row] = comp(fixture).hosts();
        expect(comp(fixture).hosts()).toHaveLength(1);
        expect(row.host()).toBe("api.stripe.com");
        expect(row.port()).toBe("8443");
        expect(comp(fixture).displayName()).toBe("api.stripe.com");
        expect(comp(fixture).id()).toBe("api-stripe-com");
        expect(comp(fixture).envVar()).toBe("API_STRIPE_COM_TOKEN");
        expect(comp(fixture).programMode()).toBe("only");
        expect(comp(fixture).programs()).toContain("/usr/bin/curl");
      });

      it("leaves any program allowed when the request names none or an unusable one", async () => {
        for (const program of [undefined, "curl", "/usr/bin/../evil"]) {
          TestBed.resetTestingModule();
          const fixture = await render({ prefill: { host: "a.example.com", port: 443, program } });
          expect(comp(fixture).programMode()).toBe("any");
          expect(comp(fixture).programs()).toEqual([]);
        }
      });

      it("still validates what was prefilled like typed input", async () => {
        const fixture = await render({ prefill: { host: "not a host", port: 99999 } });

        comp(fixture).showIssues.set(true);
        const keys = comp(fixture)
          .issues()
          .map((issue: { key: string }) => issue.key);
        expect(keys).toContain("agentAccessOsPermIssueHost");
        expect(keys).toContain("agentAccessOsPermIssuePort");
      });

      it("is ignored when editing an existing permission", async () => {
        const fixture = await render({
          profile,
          prefill: { host: "evil.example.com", port: 1234, program: "/usr/bin/wget" },
        });

        expect(
          comp(fixture)
            .hosts()
            .map((r: any) => r.host()),
        ).toEqual(["api.github.com", "github.com"]);
        expect(comp(fixture).displayName()).toBe("GitHub");
      });
    });

    it("derives the id and the env var from the name until the user edits them", async () => {
      const fixture = await render();

      comp(fixture).setName("GitHub Work");
      expect(comp(fixture).id()).toBe("github-work");
      expect(comp(fixture).envVar()).toBe("GITHUB_WORK_TOKEN");

      comp(fixture).setId("mine");
      comp(fixture).setEnvVar("MY_TOKEN");
      comp(fixture).setName("Something else");
      expect(comp(fixture).id()).toBe("mine");
      expect(comp(fixture).envVar()).toBe("MY_TOKEN");
    });

    it("blocks an empty form and shows every problem without any ipc call", async () => {
      const fixture = await render();

      await submit(fixture);

      const issues = text(fixture, "openshell-permission-issues");
      expect(issues).toContain("agentAccessOsPermIssueName");
      expect(issues).toContain("agentAccessOsPermIssueId");
      expect(issues).toContain("agentAccessOsPermIssueEnvVar");
      expect(issues).toContain("agentAccessOsPermIssueHost");
      expect(agentAccessIpc.createOpenShellProfile).not.toHaveBeenCalled();
    });

    it.each([
      ["https://api.github.com", "agentAccessOsPermIssueHost"],
      ["*", "agentAccessOsPermIssueHost"],
      ["api.github.com/path", "agentAccessOsPermIssueHost"],
    ])("rejects the host %s", async (host, key) => {
      const fixture = await render();
      fillNew(fixture);
      comp(fixture).hosts()[0].host.set(host);

      await submit(fixture);

      expect(text(fixture, "openshell-permission-issues")).toContain(key);
      expect(agentAccessIpc.createOpenShellProfile).not.toHaveBeenCalled();
    });

    it("accepts a *. wildcard host", async () => {
      const fixture = await render();
      fillNew(fixture);
      comp(fixture).hosts()[0].host.set("*.example.com");

      await submit(fixture);

      expect(agentAccessIpc.createOpenShellProfile).toHaveBeenCalled();
    });

    it.each(["0", "70000", "abc", "", "44.5"])("rejects the port %p", async (port) => {
      const fixture = await render();
      fillNew(fixture);
      comp(fixture).hosts()[0].port.set(port);

      await submit(fixture);

      expect(text(fixture, "openshell-permission-issues")).toContain("agentAccessOsPermIssuePort");
      expect(agentAccessIpc.createOpenShellProfile).not.toHaveBeenCalled();
    });

    it("rejects the same host and port twice", async () => {
      const fixture = await render();
      fillNew(fixture);
      comp(fixture).addHost();
      comp(fixture).hosts()[1].host.set("API.github.com");

      await submit(fixture);

      expect(text(fixture, "openshell-permission-issues")).toContain(
        "agentAccessOsPermIssueDuplicateHost",
      );
    });

    it("requires at least one host", async () => {
      const fixture = await render();
      fillNew(fixture);
      comp(fixture).removeHost(comp(fixture).hosts()[0]);

      await submit(fixture);

      expect(text(fixture, "openshell-permission-issues")).toContain(
        "agentAccessOsPermIssueNoHosts",
      );
    });

    it("rejects a custom program that isn't an absolute path, and adds a valid one", async () => {
      const fixture = await render();
      comp(fixture).programMode.set("only");

      for (const bad of ["curl", "/usr/../bin/x", "/opt/my tool"]) {
        comp(fixture).setCustomInput(bad);
        comp(fixture).addCustomProgram();
        expect(comp(fixture).customInvalid()).toBe(true);
        expect(comp(fixture).customPrograms()).toEqual([]);
      }

      comp(fixture).setCustomInput(" /opt/mytool ");
      comp(fixture).addCustomProgram();

      expect(comp(fixture).customInvalid()).toBe(false);
      expect(comp(fixture).customPrograms()).toEqual(["/opt/mytool"]);
      expect(comp(fixture).customInput()).toBe("");
    });

    it("needs a program when Only these programs is chosen", async () => {
      const fixture = await render();
      fillNew(fixture);
      comp(fixture).programMode.set("only");

      await submit(fixture);

      expect(text(fixture, "openshell-permission-issues")).toContain(
        "agentAccessOsPermIssueNoPrograms",
      );
      expect(agentAccessIpc.createOpenShellProfile).not.toHaveBeenCalled();
    });

    it("lists the catalog with names and the first path when Only these programs is chosen", async () => {
      const fixture = await render();
      expect(q(fixture, '[data-testid="openshell-permission-program-list"]')).toBeNull();

      comp(fixture).programMode.set("only");
      fixture.detectChanges();

      const items = Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="openshell-permission-program"]'),
      ).map((el: any) => el.textContent.replace(/\s+/g, " ").trim());
      expect(items.length).toBeGreaterThanOrEqual(8);
      expect(items.some((t) => t.includes("curl") && t.includes("/usr/bin/curl"))).toBe(true);
      expect(items.some((t) => t.includes("Claude Code"))).toBe(true);
    });

    it("rejects an id that is already taken", async () => {
      const fixture = await render({ existingIds: ["github-work"] });
      fillNew(fixture);

      await submit(fixture);

      expect(text(fixture, "openshell-permission-issues")).toContain(
        "agentAccessOsPermIssueIdTaken|github-work",
      );
    });

    it("warns when no program is listed, and stops warning once one is", async () => {
      const fixture = await render();
      expect(q(fixture, '[data-testid="openshell-permission-any-program"]')).not.toBeNull();

      comp(fixture).programMode.set("only");
      fixture.detectChanges();

      expect(q(fixture, '[data-testid="openshell-permission-any-program"]')).toBeNull();
    });

    it("sends exactly the form to createOpenShellProfile and closes with true", async () => {
      const fixture = await render();
      fillNew(fixture);
      comp(fixture).description.set("  For work  ");
      comp(fixture).addHost();
      const second = comp(fixture).hosts()[1];
      second.host.set("github.com");
      second.port.set("8443");
      comp(fixture).setAccess(second, "read-write");
      comp(fixture).programMode.set("only");
      comp(fixture).toggleProgram("curl", true);
      comp(fixture).toggleProgram("gh", true);
      comp(fixture).setCustomInput("/opt/mytool");
      comp(fixture).addCustomProgram();

      await submit(fixture);

      expect(agentAccessIpc.createOpenShellProfile).toHaveBeenCalledWith({
        id: "github-work",
        displayName: "GitHub Work",
        description: "For work",
        credentialEnvVar: "GITHUB_WORK_TOKEN",
        endpoints: [
          { host: "api.github.com", port: 443, access: "read-only" },
          { host: "github.com", port: 8443, access: "read-write" },
        ],
        binaries: [
          "/usr/bin/curl",
          "/usr/local/bin/curl",
          "/usr/bin/gh",
          "/usr/local/bin/gh",
          "/opt/mytool",
        ],
      });
      expect(agentAccessIpc.updateOpenShellProfile).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it("shows the failure and stays open when the gateway refuses", async () => {
      agentAccessIpc.createOpenShellProfile.mockResolvedValue({
        ok: false,
        error: "alreadyExists",
      });
      const fixture = await render();
      fillNew(fixture);

      await submit(fixture);

      expect(text(fixture, "openshell-permission-error")).toContain(
        "agentAccessOsPermErrorAlreadyExists",
      );
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("shows the scrubbed message of another failure", async () => {
      agentAccessIpc.createOpenShellProfile.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "boom",
      });
      const fixture = await render();
      fillNew(fixture);

      await submit(fixture);

      expect(text(fixture, "openshell-permission-error")).toContain("boom");
    });

    it("close() closes with false", async () => {
      const fixture = await render();

      comp(fixture).close();

      expect(dialogRef.close).toHaveBeenCalledWith(false);
    });
  });

  describe("editing", () => {
    it("fills the form from the profile and hides the id and env var fields", async () => {
      const fixture = await render({ profile });

      expect(comp(fixture).displayName()).toBe("GitHub");
      expect(comp(fixture).description()).toBe("Work account");
      expect(comp(fixture).programMode()).toBe("only");
      expect(comp(fixture).selectedPrograms()).toEqual(["curl"]);
      expect(comp(fixture).customPrograms()).toEqual([]);
      expect(
        comp(fixture)
          .hosts()
          .map((r: any) => [r.host(), r.port(), r.access()]),
      ).toEqual([
        ["api.github.com", "443", "read-only"],
        ["github.com", "443", "read-write"],
      ]);
      expect(q(fixture, "#agent-access-openshell-permission-dialog_input_env-var")).toBeNull();
      expect(q(fixture, "#agent-access-openshell-permission-dialog_input_id")).toBeNull();
    });

    it("warns that the permission is shared and names the affected sandboxes", async () => {
      const fixture = await render({ profile });

      expect(q(fixture, '[data-testid="openshell-permission-shared"]')).not.toBeNull();
      expect(text(fixture, "openshell-permission-affected")).toContain("alpha");
      expect(text(fixture, "openshell-permission-affected")).not.toContain("beta");
    });

    it("says no sandbox uses it when none does", async () => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue({ ok: true, data: [] });
      const fixture = await render({ profile });

      expect(text(fixture, "openshell-permission-affected")).toContain(
        "agentAccessOsPermAffectedNone",
      );
    });

    it("says the list may be incomplete when a sandbox couldn't be read, or the list failed", async () => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue({ ok: false, error: "failed" });
      const incomplete = await render({ profile });
      expect(text(incomplete, "openshell-permission-affected")).toContain(
        "agentAccessOsPermAffectedIncomplete",
      );

      TestBed.resetTestingModule();
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue({ ok: false, error: "failed" });
      const unknown = await render({ profile });
      expect(text(unknown, "openshell-permission-affected")).toContain(
        "agentAccessOsPermAffectedIncomplete",
      );
    });

    it("sends exactly the edited fields to updateOpenShellProfile, with no confirmation when nothing widens", async () => {
      const fixture = await render({ profile });
      comp(fixture).setName("GitHub (work)");
      comp(fixture).description.set("");
      comp(fixture).removeHost(comp(fixture).hosts()[1]);
      comp(fixture).setAccess(comp(fixture).hosts()[0], "read-only");

      await submit(fixture);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(agentAccessIpc.updateOpenShellProfile).toHaveBeenCalledWith({
        id: "github",
        displayName: "GitHub (work)",
        description: "",
        endpoints: [{ host: "api.github.com", port: 443, access: "read-only" }],
        binaries: ["/usr/bin/curl"],
      });
      expect(agentAccessIpc.createOpenShellProfile).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it("needs no confirmation when the same thing is saved unchanged", async () => {
      const fixture = await render({ profile });

      await submit(fixture);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(agentAccessIpc.updateOpenShellProfile).toHaveBeenCalled();
    });

    describe("widening", () => {
      it("confirms a new host, naming it, and stops when declined", async () => {
        dialogService.openSimpleDialog.mockResolvedValue(false);
        const fixture = await render({ profile });
        comp(fixture).addHost();
        const added = comp(fixture).hosts()[2];
        added.host.set("evil.example.com");

        await submit(fixture);

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "warning",
            content: {
              key: "agentAccessOsPermWidenContent",
              placeholders: ["agentAccessOsPermWidenHost|evil.example.com:443"],
            },
          }),
        );
        expect(agentAccessIpc.updateOpenShellProfile).not.toHaveBeenCalled();
        expect(dialogRef.close).not.toHaveBeenCalled();
      });

      it("saves after the confirmation is accepted", async () => {
        const fixture = await render({ profile });
        comp(fixture).addHost();
        comp(fixture).hosts()[2].host.set("evil.example.com");

        await submit(fixture);

        expect(agentAccessIpc.updateOpenShellProfile).toHaveBeenCalledTimes(1);
        expect(dialogRef.close).toHaveBeenCalledWith(true);
      });

      it("confirms read-only becoming read and write", async () => {
        const fixture = await render({ profile });
        comp(fixture).setAccess(comp(fixture).hosts()[0], "read-write");

        await submit(fixture);

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({
            content: {
              key: "agentAccessOsPermWidenContent",
              placeholders: ["agentAccessOsPermWidenAccess|api.github.com:443"],
            },
          }),
        );
      });

      it("treats an endpoint with no recorded access as narrower than read and write", async () => {
        const unknownAccess = {
          ...profile,
          endpoints: [{ host: "api.github.com", port: 443 }],
        };
        const fixture = await render({ profile: unknownAccess });
        comp(fixture).setAccess(comp(fixture).hosts()[0], "read-write");

        await submit(fixture);

        expect(dialogService.openSimpleDialog).toHaveBeenCalled();
      });

      it("confirms removing the program restriction", async () => {
        const fixture = await render({ profile });
        comp(fixture).programMode.set("any");

        await submit(fixture);

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({
            content: {
              key: "agentAccessOsPermWidenContent",
              placeholders: ["agentAccessOsPermWidenAnyProgram"],
            },
          }),
        );
      });

      it("confirms an added program, but not a removed one", async () => {
        const fixture = await render({
          profile: { ...profile, binaries: ["/usr/bin/curl", "/usr/bin/gh"] },
        });
        comp(fixture).toggleProgram("gh", false);
        await submit(fixture);
        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();

        comp(fixture).toggleProgram("wget", true);
        await submit(fixture);
        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({
            content: {
              key: "agentAccessOsPermWidenContent",
              placeholders: ["agentAccessOsPermWidenProgram|wget"],
            },
          }),
        );
      });

      it("keeps the paths a program already had, and doesn't widen it with the catalog's other location", async () => {
        const fixture = await render({ profile });

        await submit(fixture);

        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        expect(agentAccessIpc.updateOpenShellProfile).toHaveBeenCalledWith(
          expect.objectContaining({ binaries: ["/usr/bin/curl"] }),
        );
      });

      it("confirms an added custom program by its path", async () => {
        const fixture = await render({ profile });
        comp(fixture).setCustomInput("/opt/mytool");
        comp(fixture).addCustomProgram();

        await submit(fixture);

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({
            content: {
              key: "agentAccessOsPermWidenContent",
              placeholders: ["agentAccessOsPermWidenProgram|/opt/mytool"],
            },
          }),
        );
      });

      it("doesn't confirm when a permission with no program list stays unrestricted", async () => {
        const fixture = await render({ profile: { ...profile, binaries: [] } });

        await submit(fixture);

        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      });

      it("lists every widening in one confirmation", async () => {
        const fixture = await render({ profile });
        comp(fixture).addHost();
        comp(fixture).hosts()[2].host.set("new.example.com");
        comp(fixture).setAccess(comp(fixture).hosts()[0], "read-write");
        comp(fixture).programMode.set("any");

        await submit(fixture);

        const call = dialogService.openSimpleDialog.mock.calls[0][0] as any;
        expect(call.content.placeholders[0].split("; ")).toHaveLength(3);
        expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
      });
    });

    it("shows the failure and stays open when the update is refused", async () => {
      agentAccessIpc.updateOpenShellProfile.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "nope",
      });
      const fixture = await render({ profile });

      await submit(fixture);

      expect(text(fixture, "openshell-permission-error")).toContain("nope");
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });
});
