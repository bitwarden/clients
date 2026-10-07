import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { AgentAccessOpenShellPermissionDialogComponent } from "./agent-access-openshell-permission-dialog.component";
import { AgentAccessOpenShellPermissionsTabComponent } from "./agent-access-openshell-permissions-tab.component";

const credential = (providerName: string, profileId: string | null, envVar = "TOKEN") => ({
  providerName,
  profileId,
  managed: true,
  bindings: [{ envVar, resourceType: "item", id: "x", field: "password", label: "Item" }],
});

const github = {
  id: "github",
  displayName: "GitHub",
  description: "",
  credentials: [],
  endpoints: [
    { host: "api.github.com", port: 443, access: "read-only" },
    { host: "github.com", port: 443 },
  ],
  binaries: ["/usr/bin/curl"],
  editable: true,
};
const builtIn = {
  id: "aws",
  displayName: "AWS",
  description: "",
  credentials: [],
  endpoints: [{ host: "amazonaws.com", port: 443 }],
  editable: false,
};
const spare = {
  id: "spare",
  displayName: "Spare",
  description: "",
  credentials: [],
  endpoints: [{ host: "example.com", port: 443 }],
  editable: true,
};

describe("AgentAccessOpenShellPermissionsTabComponent", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let originalIpc: unknown;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let credentialsBySandbox: Record<string, unknown[]>;

  beforeEach(() => {
    credentialsBySandbox = {
      alpha: [credential("github-alpha", "github", "GITHUB_TOKEN")],
      beta: [credential("github-beta", "github")],
    };
    agentAccessIpc = {
      listOpenShellSandboxes: jest.fn().mockResolvedValue({
        ok: true,
        data: [{ name: "alpha" }, { name: "beta" }],
      }),
      listOpenShellCredentials: jest
        .fn()
        .mockImplementation(async ({ sandboxName }: { sandboxName: string }) => ({
          ok: true,
          data: credentialsBySandbox[sandboxName] ?? [],
        })),
      listOpenShellProfiles: jest
        .fn()
        .mockResolvedValue({ ok: true, data: [github, builtIn, spare] }),
      deleteOpenShellProfile: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };
    dialogService = mock<DialogService>();
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  async function render(): Promise<ComponentFixture<AgentAccessOpenShellPermissionsTabComponent>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    const paramMap = new BehaviorSubject(convertToParamMap({ name: "alpha" }));
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellPermissionsTabComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { parent: { paramMap, snapshot: { paramMap: paramMap.value } } },
        },
        { provide: I18nService, useValue: i18n },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: DialogService, useValue: dialogService },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellPermissionsTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const comp = (f: ComponentFixture<unknown>) => f.componentInstance as any;
  const q = (fixture: ComponentFixture<unknown>, selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
  const rows = (fixture: ComponentFixture<unknown>) =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '[data-testid="openshell-permission-row"]',
      ),
    );
  const rowFor = (fixture: ComponentFixture<unknown>, id: string) =>
    comp(fixture)
      .rows()
      .find((r: any) => r.id === id);

  it("reads this sandbox's credentials, the profiles and which sandboxes use what", async () => {
    await render();

    expect(agentAccessIpc.listOpenShellCredentials).toHaveBeenCalledWith({ sandboxName: "alpha" });
    expect(agentAccessIpc.listOpenShellCredentials).toHaveBeenCalledWith({ sandboxName: "beta" });
    expect(agentAccessIpc.listOpenShellProfiles).toHaveBeenCalled();
  });

  it("lists every permission on the gateway, with hosts, access and programs", async () => {
    const fixture = await render();

    expect(rows(fixture)).toHaveLength(3);
    const [first] = rows(fixture);
    expect(first.textContent).toContain("GitHub");
    expect(first.textContent).toContain("api.github.com:443");
    expect(first.textContent).toContain("read-only");
    expect(first.textContent).toContain("github.com:443");
    expect(first.textContent).toContain("curl");
    expect(first.textContent).not.toContain("/usr/bin/curl");
    expect(first.textContent).toContain("GITHUB_TOKEN");
  });

  it("says any program may use a permission that lists none", async () => {
    const fixture = await render();

    expect(rows(fixture)[1].textContent).toContain("agentAccessOsPermProgramsAny");
  });

  it("shows agent logos for Claude Code, generic icons for tools, and custom programs as paths", async () => {
    agentAccessIpc.listOpenShellProfiles.mockResolvedValue({
      ok: true,
      data: [
        {
          ...github,
          binaries: ["/usr/local/bin/claude", "/usr/bin/curl", "/opt/mytool"],
        },
      ],
    });
    const fixture = await render();

    const programs = Array.from(
      rows(fixture)[0].querySelectorAll("app-agent-access-openshell-program-icon"),
    );
    expect(programs).toHaveLength(2);
    // Catalog order: curl (generic icon), then Claude Code (its logo).
    expect(programs[0].querySelector("bit-svg")).toBeNull();
    expect(programs[1].querySelector("bit-svg")).not.toBeNull();
    expect(rows(fixture)[0].textContent).toContain("Claude Code");
    expect(rows(fixture)[0].textContent).toContain("/opt/mytool");
    expect(rows(fixture)[0].textContent).not.toContain("/usr/local/bin/claude");
  });

  it("names the sandboxes using each permission, or says none do", async () => {
    const fixture = await render();

    const usedBy = rows(fixture).map(
      (r) => r.querySelector('[data-testid="openshell-permission-used-by"]')?.textContent,
    );
    expect(usedBy[0]).toContain("alpha, beta");
    expect(usedBy[2]).toContain("agentAccessOsPermUnused");
  });

  it("shows a menu only for permissions that can be edited, and Built in for the rest", async () => {
    const fixture = await render();

    expect(q(fixture, "#agent-access-openshell-permissions_button_options-github")).not.toBeNull();
    expect(q(fixture, "#agent-access-openshell-permissions_button_options-spare")).not.toBeNull();
    expect(q(fixture, "#agent-access-openshell-permissions_button_options-aws")).toBeNull();
    const builtInBadges = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '[data-testid="openshell-permission-builtin"]',
    );
    expect(builtInBadges).toHaveLength(1);
  });

  it("still shows a permission a credential names that the gateway doesn't list", async () => {
    credentialsBySandbox["alpha"] = [credential("gone-alpha", "gone", "GONE_TOKEN")];
    const fixture = await render();

    const gone = rowFor(fixture, "gone");
    expect(gone.editable).toBe(false);
    expect(gone.profile).toBeNull();
    expect(
      rows(fixture).some((r) => r.textContent?.includes("agentAccessOsPermHostsUnknown")),
    ).toBe(true);
  });

  it("says the hosts are unknown when the profile list can't be read, with an error", async () => {
    agentAccessIpc.listOpenShellProfiles.mockResolvedValue({
      ok: false,
      error: "failed",
      message: "boom",
    });
    const fixture = await render();

    expect(q(fixture, '[data-testid="openshell-permissions-error"]')?.textContent).toContain(
      "boom",
    );
    expect(rows(fixture)).toHaveLength(0);
  });

  it("shows an error callout when the credentials can't be read", async () => {
    agentAccessIpc.listOpenShellCredentials.mockResolvedValue({
      ok: false,
      error: "failed",
      message: "boom",
    });
    const fixture = await render();

    expect(q(fixture, '[data-testid="openshell-permissions-error"]')).not.toBeNull();
  });

  describe("empty", () => {
    it("offers New permission when the gateway has none", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue({ ok: true, data: [] });
      credentialsBySandbox = {};
      const fixture = await render();

      expect(q(fixture, '[data-testid="openshell-permissions-empty"]')).not.toBeNull();
      expect(q(fixture, "#agent-access-openshell-permissions_button_new-empty")).not.toBeNull();
    });
  });

  describe("New permission", () => {
    it("opens the dialog with the ids already taken, and reloads when something was saved", async () => {
      const open = jest
        .spyOn(AgentAccessOpenShellPermissionDialogComponent, "open")
        .mockReturnValue({ closed: of(true) } as any);
      const fixture = await render();
      agentAccessIpc.listOpenShellProfiles.mockClear();

      (q(fixture, "#agent-access-openshell-permissions_button_new") as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(open).toHaveBeenCalledWith(dialogService, {
        existingIds: ["github", "aws", "spare"],
      });
      expect(agentAccessIpc.listOpenShellProfiles).toHaveBeenCalledTimes(1);
    });

    it("doesn't reload when the dialog was cancelled", async () => {
      jest
        .spyOn(AgentAccessOpenShellPermissionDialogComponent, "open")
        .mockReturnValue({ closed: of(false) } as any);
      const fixture = await render();
      agentAccessIpc.listOpenShellProfiles.mockClear();

      await comp(fixture).openNew();

      expect(agentAccessIpc.listOpenShellProfiles).not.toHaveBeenCalled();
    });
  });

  describe("Edit", () => {
    it("opens the dialog on the profile and reloads after a save", async () => {
      const open = jest
        .spyOn(AgentAccessOpenShellPermissionDialogComponent, "open")
        .mockReturnValue({ closed: of(true) } as any);
      const fixture = await render();
      agentAccessIpc.listOpenShellProfiles.mockClear();

      await comp(fixture).edit(rowFor(fixture, "github"));

      expect(open).toHaveBeenCalledWith(dialogService, { profile: github });
      expect(agentAccessIpc.listOpenShellProfiles).toHaveBeenCalledTimes(1);
    });
  });

  describe("Delete", () => {
    it("is allowed only for an editable permission no sandbox uses", async () => {
      const fixture = await render();

      expect(comp(fixture).canDelete(rowFor(fixture, "spare"))).toBe(true);
      expect(comp(fixture).canDelete(rowFor(fixture, "github"))).toBe(false);
      expect(comp(fixture).canDelete(rowFor(fixture, "aws"))).toBe(false);
    });

    it("is not allowed when some sandbox could not be read, because unused can't be trusted", async () => {
      agentAccessIpc.listOpenShellCredentials.mockImplementation(
        async ({ sandboxName }: { sandboxName: string }) =>
          sandboxName === "beta"
            ? { ok: false, error: "failed" }
            : { ok: true, data: credentialsBySandbox[sandboxName] ?? [] },
      );
      const fixture = await render();

      expect(comp(fixture).canDelete(rowFor(fixture, "spare"))).toBe(false);
    });

    it("is not allowed when the sandbox list can't be read", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue({ ok: false, error: "failed" });
      const fixture = await render();

      expect(comp(fixture).canDelete(rowFor(fixture, "spare"))).toBe(false);
    });

    it("sends nothing for a permission that is in use", async () => {
      const fixture = await render();

      await comp(fixture).delete(rowFor(fixture, "github"));

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(agentAccessIpc.deleteOpenShellProfile).not.toHaveBeenCalled();
    });

    it("sends nothing when the confirmation is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const fixture = await render();

      await comp(fixture).delete(rowFor(fixture, "spare"));

      expect(agentAccessIpc.deleteOpenShellProfile).not.toHaveBeenCalled();
    });

    it("deletes after confirmation, then reloads", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();
      agentAccessIpc.listOpenShellProfiles.mockClear();

      await comp(fixture).delete(rowFor(fixture, "spare"));

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "agentAccessOsPermDeleteContent", placeholders: ["Spare"] },
          type: "danger",
        }),
      );
      expect(agentAccessIpc.deleteOpenShellProfile).toHaveBeenCalledWith({ id: "spare" });
      expect(agentAccessIpc.listOpenShellProfiles).toHaveBeenCalledTimes(1);
    });

    it("shows the scrubbed message when the delete fails", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      agentAccessIpc.deleteOpenShellProfile.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "in use elsewhere",
      });
      const fixture = await render();

      await comp(fixture).delete(rowFor(fixture, "spare"));
      fixture.detectChanges();

      expect(
        q(fixture, '[data-testid="openshell-permissions-action-error"]')?.textContent,
      ).toContain("in use elsewhere");
    });
  });
});
