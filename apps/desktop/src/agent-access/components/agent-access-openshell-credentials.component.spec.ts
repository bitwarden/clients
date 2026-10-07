import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  OpenShellManagementResult,
  OpenShellSandboxCredential,
} from "../models/openshell-management";

import { AgentAccessOpenShellAddCredentialDialogComponent } from "./agent-access-openshell-add-credential-dialog.component";
import { AgentAccessOpenShellCredentialsComponent } from "./agent-access-openshell-credentials.component";
import { AgentAccessOpenShellSetNameDialogComponent } from "./agent-access-openshell-set-name-dialog.component";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const SECRET_ID = "22222222-2222-4222-8222-222222222222";

const managed: OpenShellSandboxCredential = {
  providerName: "github-sb1",
  profileId: "github",
  managed: true,
  bindings: [
    {
      envVar: "GITHUB_TOKEN",
      resourceType: "item",
      id: ITEM_ID,
      field: "password",
      label: "GitHub",
    },
    {
      envVar: "DEPLOY_KEY",
      resourceType: "secret",
      id: SECRET_ID,
      field: "value",
      label: "Deploy",
    },
  ],
};

const unmanaged: OpenShellSandboxCredential = {
  providerName: "legacy",
  profileId: "openai",
  managed: false,
  bindings: [],
};

const ok = <T>(data: T): OpenShellManagementResult<T> => ({ ok: true, data });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("AgentAccessOpenShellCredentialsComponent (§M8.20)", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let originalIpc: unknown;

  beforeAll(() => {
    (global as any).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    agentAccessIpc = {
      listOpenShellCredentials: jest.fn().mockResolvedValue(ok([managed, unmanaged])),
      listOpenShellProfiles: jest.fn().mockResolvedValue(
        ok([
          {
            id: "github",
            displayName: "GitHub API",
            description: "",
            credentials: [],
            endpoints: [],
          },
        ]),
      ),
      removeOpenShellCredential: jest.fn().mockResolvedValue(ok(undefined)),
      getOpenShellApplyStatus: jest
        .fn()
        .mockResolvedValue(ok({ applied: false, detail: "pending" })),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };
    dialogService = mock<DialogService>();
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    TestBed.resetTestingModule();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function settle(fixture: ComponentFixture<unknown>) {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  async function render(
    sandboxName = "sb1",
  ): Promise<ComponentFixture<AgentAccessOpenShellCredentialsComponent>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellCredentialsComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ValidationService, useValue: mock<ValidationService>() },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellCredentialsComponent);
    fixture.componentRef.setInput("sandboxName", sandboxName);
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  const q = (fixture: ComponentFixture<unknown>, selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);
  const qa = (fixture: ComponentFixture<unknown>, selector: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));
  const statusText = (fixture: ComponentFixture<unknown>) =>
    q(fixture, '[data-testid="openshell-credentials-apply-status"]')?.textContent?.trim();

  describe("states", () => {
    it("shows a skeleton while loading", async () => {
      const pending = deferred<OpenShellManagementResult<OpenShellSandboxCredential[]>>();
      agentAccessIpc.listOpenShellCredentials.mockReturnValue(pending.promise);
      const fixture = await render();
      expect(q(fixture, '[data-testid="openshell-credentials-loading"]')).not.toBeNull();
      expect(q(fixture, '[data-testid="openshell-credentials-empty"]')).toBeNull();
      pending.resolve(ok([]));
      await settle(fixture);
      expect(q(fixture, '[data-testid="openshell-credentials-loading"]')).toBeNull();
    });

    it("asks for the credentials of the named sandbox", async () => {
      await render("sb1");
      expect(agentAccessIpc.listOpenShellCredentials).toHaveBeenCalledWith({ sandboxName: "sb1" });
    });

    it("lists a managed provider's bindings as display text", async () => {
      const fixture = await render();
      const rows = qa(fixture, '[data-testid="openshell-credential-row"]');
      expect(rows).toHaveLength(2);
      const text = rows[0].textContent ?? "";
      expect(text).toContain("GitHub");
      expect(text).toContain("GITHUB_TOKEN");
      expect(text).toContain("GitHub API");
      const bindings = qa(fixture, '[data-testid="openshell-credential-binding"]').map((b) =>
        b.textContent?.replace(/\s+/g, " ").trim(),
      );
      expect(bindings).toEqual(["GitHub(password)", "Deploy(agentAccessOsCredFieldValue)"]);
    });

    it("shows the profile's display name in the Permission column", async () => {
      const fixture = await render();
      const cells = qa(fixture, '[data-testid="openshell-credential-row"]').map((row) =>
        row.querySelectorAll("td")[2].textContent?.trim(),
      );
      expect(cells).toEqual(["GitHub API", "openai"]);
    });

    it("falls back to the profile id when the profile list fails", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue({
        ok: false,
        error: "failed",
      });
      const fixture = await render();
      const cells = qa(fixture, '[data-testid="openshell-credential-row"]').map((row) =>
        row.querySelectorAll("td")[2].textContent?.trim(),
      );
      expect(cells).toEqual(["github", "openai"]);
      expect(q(fixture, '[data-testid="openshell-credentials-error"]')).toBeNull();
    });

    it("shows an unmanaged provider by name only", async () => {
      const fixture = await render();
      const row = qa(fixture, '[data-testid="openshell-credential-row"]')[1];
      expect(row.textContent).toContain("legacy");
      expect(
        row.querySelector('[data-testid="openshell-credential-unmanaged"]')?.textContent,
      ).toContain("agentAccessOsCredUnmanaged");
      expect(row.querySelector('[data-testid="openshell-credential-binding"]')).toBeNull();
    });

    it("shows the empty state with an Add button", async () => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue(ok([]));
      const fixture = await render();
      expect(q(fixture, '[data-testid="openshell-credentials-empty"]')).not.toBeNull();
      expect(q(fixture, "#agent-access-openshell-credentials_button_add-empty")).not.toBeNull();
    });

    it.each([
      ["cliMissing", "agentAccessOsCredErrorCliMissing"],
      ["gatewayUnreachable", "agentAccessOsCredErrorGatewayUnreachable"],
      ["unsupported", "agentAccessOsCredErrorUnsupported"],
      ["failed", "agentAccessOsCredErrorFailed"],
    ] as const)("shows a callout for %s", async (error, key) => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue({
        ok: false,
        error,
        message: "scrubbed <b>text</b>",
      });
      const fixture = await render();
      const callout = q(fixture, '[data-testid="openshell-credentials-error"]');
      expect(callout?.textContent).toContain(key);
      // Gateway text is text, never markup.
      expect(callout?.textContent).toContain("scrubbed <b>text</b>");
      expect(callout?.querySelector("b")).toBeNull();
      expect(q(fixture, '[data-testid="openshell-credentials-empty"]')).toBeNull();
    });

    it("retries after an error", async () => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValueOnce({
        ok: false,
        error: "gatewayUnreachable",
      });
      const fixture = await render();
      (q(fixture, "#agent-access-openshell-credentials_button_retry") as HTMLButtonElement).click();
      await settle(fixture);
      expect(agentAccessIpc.listOpenShellCredentials).toHaveBeenCalledTimes(2);
      expect(qa(fixture, '[data-testid="openshell-credential-row"]')).toHaveLength(2);
    });
  });

  describe("sandbox changes", () => {
    it("reloads for the new sandbox and ignores a late response for the old one", async () => {
      const first = deferred<OpenShellManagementResult<OpenShellSandboxCredential[]>>();
      const second = deferred<OpenShellManagementResult<OpenShellSandboxCredential[]>>();
      agentAccessIpc.listOpenShellCredentials.mockImplementation(
        ({ sandboxName }: { sandboxName: string }) =>
          (sandboxName === "a" ? first : second).promise,
      );
      const fixture = await render("a");

      fixture.componentRef.setInput("sandboxName", "b");
      fixture.detectChanges();
      await settle(fixture);
      expect(agentAccessIpc.listOpenShellCredentials).toHaveBeenLastCalledWith({
        sandboxName: "b",
      });

      second.resolve(ok([unmanaged]));
      await settle(fixture);
      first.resolve(ok([managed]));
      await settle(fixture);

      const names = qa(fixture, '[data-testid="openshell-credential-row"]').map(
        (r) => r.textContent,
      );
      expect(names).toHaveLength(1);
      expect(names[0]).toContain("legacy");
      expect(names[0]).not.toContain("github-sb1");
    });

    it("stops polling and clears the status when the sandbox changes", async () => {
      jest.useFakeTimers();
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render("a");
      await (fixture.componentInstance as any).removeAction(unmanaged)();
      await settle(fixture);
      expect(statusText(fixture)).toBe("agentAccessOsCredApplyWaiting");
      fixture.componentRef.setInput("sandboxName", "b");
      fixture.detectChanges();
      await settle(fixture);
      expect(statusText(fixture)).toBeUndefined();
      agentAccessIpc.getOpenShellApplyStatus.mockClear();
      await jest.advanceTimersByTimeAsync(10_000);
      expect(agentAccessIpc.getOpenShellApplyStatus).not.toHaveBeenCalled();
    });
  });

  describe("removing a credential", () => {
    const removeButton = (fixture: ComponentFixture<unknown>, name: string) =>
      q(fixture, `[id="agent-access-openshell-credentials_button_remove-${name}"]`);

    it("renders a remove button per row", async () => {
      const fixture = await render();
      expect(removeButton(fixture, "github-sb1")).not.toBeNull();
      expect(removeButton(fixture, "legacy")).not.toBeNull();
    });

    it.each([
      ["managed", managed],
      ["unmanaged", unmanaged],
    ])("sends nothing when the %s removal is declined", async (_label, credential) => {
      dialogService.openSimpleDialog.mockResolvedValueOnce(false);
      const fixture = await render();
      await (fixture.componentInstance as any).removeAction(credential)();
      expect(agentAccessIpc.removeOpenShellCredential).not.toHaveBeenCalled();
      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
      expect(statusText(fixture)).toBeUndefined();
    });

    it("removes an unmanaged provider without offering to delete it", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();
      await (fixture.componentInstance as any).removeAction(unmanaged)();
      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
      expect(agentAccessIpc.removeOpenShellCredential).toHaveBeenCalledWith({
        sandboxName: "sb1",
        providerName: "legacy",
        deleteProvider: false,
      });
    });

    it("also deletes a managed provider when the second prompt is accepted", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();
      await (fixture.componentInstance as any).removeAction(managed)();
      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(2);
      expect(agentAccessIpc.removeOpenShellCredential).toHaveBeenCalledWith({
        sandboxName: "sb1",
        providerName: "github-sb1",
        deleteProvider: true,
      });
    });

    it("keeps a managed provider when only the detach is confirmed", async () => {
      dialogService.openSimpleDialog.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const fixture = await render();
      await (fixture.componentInstance as any).removeAction(managed)();
      expect(agentAccessIpc.removeOpenShellCredential).toHaveBeenCalledWith({
        sandboxName: "sb1",
        providerName: "github-sb1",
        deleteProvider: false,
      });
    });

    it("reloads the list after a removal", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue(ok([unmanaged]));
      await (fixture.componentInstance as any).removeAction(managed)();
      await settle(fixture);
      expect(qa(fixture, '[data-testid="openshell-credential-row"]')).toHaveLength(1);
    });

    it("shows the scrubbed error and does not poll when the removal fails", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      agentAccessIpc.removeOpenShellCredential.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "denied by gateway",
      });
      const fixture = await render();
      await (fixture.componentInstance as any).removeAction(unmanaged)();
      await settle(fixture);
      expect(
        q(fixture, '[data-testid="openshell-credentials-action-error"]')?.textContent,
      ).toContain("denied by gateway");
      expect(agentAccessIpc.getOpenShellApplyStatus).not.toHaveBeenCalled();
      expect(qa(fixture, '[data-testid="openshell-credential-row"]')).toHaveLength(2);
    });
  });

  describe("apply status", () => {
    async function removeOne(fixture: ComponentFixture<AgentAccessOpenShellCredentialsComponent>) {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      await (fixture.componentInstance as any).removeAction(unmanaged)();
      await settle(fixture);
    }

    it("waits, polls every 2 s, and stops once applied", async () => {
      jest.useFakeTimers();
      agentAccessIpc.getOpenShellApplyStatus
        .mockResolvedValueOnce(ok({ applied: false, detail: "" }))
        .mockResolvedValueOnce(ok({ applied: false, detail: "" }))
        .mockResolvedValue(ok({ applied: true, detail: "" }));
      const fixture = await render();
      await removeOne(fixture);
      expect(statusText(fixture)).toBe("agentAccessOsCredApplyWaiting");
      expect(agentAccessIpc.getOpenShellApplyStatus).toHaveBeenCalledTimes(1);
      expect(agentAccessIpc.getOpenShellApplyStatus).toHaveBeenCalledWith({ sandboxName: "sb1" });

      await jest.advanceTimersByTimeAsync(2_000);
      expect(agentAccessIpc.getOpenShellApplyStatus).toHaveBeenCalledTimes(2);
      expect(statusText(fixture)).toBe("agentAccessOsCredApplyWaiting");

      await jest.advanceTimersByTimeAsync(2_000);
      fixture.detectChanges();
      expect(agentAccessIpc.getOpenShellApplyStatus).toHaveBeenCalledTimes(3);
      expect(statusText(fixture)).toBe("agentAccessOsCredApplyApplied");

      await jest.advanceTimersByTimeAsync(20_000);
      expect(agentAccessIpc.getOpenShellApplyStatus).toHaveBeenCalledTimes(3);
    });

    it("gives up after 30 s", async () => {
      jest.useFakeTimers();
      const fixture = await render();
      await removeOne(fixture);
      await jest.advanceTimersByTimeAsync(30_000);
      fixture.detectChanges();
      expect(statusText(fixture)).toBe("agentAccessOsCredApplyTimedOut");
      const calls = agentAccessIpc.getOpenShellApplyStatus.mock.calls.length;
      expect(calls).toBe(16);
      await jest.advanceTimersByTimeAsync(10_000);
      expect(agentAccessIpc.getOpenShellApplyStatus).toHaveBeenCalledTimes(calls);
    });

    it("keeps waiting through a failed status call", async () => {
      jest.useFakeTimers();
      agentAccessIpc.getOpenShellApplyStatus
        .mockResolvedValueOnce({ ok: false, error: "failed" })
        .mockResolvedValue(ok({ applied: true, detail: "" }));
      const fixture = await render();
      await removeOne(fixture);
      await jest.advanceTimersByTimeAsync(2_000);
      fixture.detectChanges();
      expect(statusText(fixture)).toBe("agentAccessOsCredApplyApplied");
    });

    it("stops polling when the component is destroyed", async () => {
      jest.useFakeTimers();
      const fixture = await render();
      await removeOne(fixture);
      const calls = agentAccessIpc.getOpenShellApplyStatus.mock.calls.length;
      fixture.destroy();
      await jest.advanceTimersByTimeAsync(30_000);
      expect(agentAccessIpc.getOpenShellApplyStatus).toHaveBeenCalledTimes(calls);
    });
  });

  describe("adding a credential", () => {
    it("opens the add dialog for this sandbox and polls after a successful add", async () => {
      jest.useFakeTimers();
      const open = jest
        .spyOn(AgentAccessOpenShellAddCredentialDialogComponent, "open")
        .mockReturnValue({ closed: of(true) } as any);
      const fixture = await render();
      await (fixture.componentInstance as any).openAddDialog();
      await settle(fixture);
      expect(open).toHaveBeenCalledWith(dialogService, { sandboxName: "sb1" });
      expect(agentAccessIpc.listOpenShellCredentials).toHaveBeenCalledTimes(2);
      expect(agentAccessIpc.getOpenShellApplyStatus).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the dialog is cancelled", async () => {
      jest
        .spyOn(AgentAccessOpenShellAddCredentialDialogComponent, "open")
        .mockReturnValue({ closed: of(undefined) } as any);
      const fixture = await render();
      await (fixture.componentInstance as any).openAddDialog();
      await settle(fixture);
      expect(agentAccessIpc.listOpenShellCredentials).toHaveBeenCalledTimes(1);
      expect(agentAccessIpc.getOpenShellApplyStatus).not.toHaveBeenCalled();
    });

    it("offers the Add button in the header once there are credentials", async () => {
      const fixture = await render();
      expect(q(fixture, "#agent-access-openshell-credentials_button_add")).not.toBeNull();
    });
  });

  describe("changing a permission", () => {
    const single: OpenShellSandboxCredential = {
      providerName: "github-sb1",
      profileId: "github",
      managed: true,
      bindings: [
        {
          envVar: "GITHUB_TOKEN",
          resourceType: "item",
          id: ITEM_ID,
          field: "password",
          label: "GitHub",
        },
      ],
    };

    const profile = (id: string, displayName: string, envVars: string[], required = true) => ({
      id,
      displayName,
      description: "",
      credentials: [{ name: "token", description: "", envVars, required }],
      endpoints: [{ host: `${id}.example.com`, port: 443 }],
    });
    const twoProfiles = [
      profile("github", "GitHub API", ["GITHUB_TOKEN"]),
      profile("gitlab", "GitLab API", ["GITLAB_TOKEN"]),
    ];

    const select = (fixture: ComponentFixture<unknown>, name = "github-sb1") =>
      q(
        fixture,
        `[id="agent-access-openshell-credentials_select_permission-${name}"]`,
      ) as HTMLSelectElement | null;

    beforeEach(() => {
      agentAccessIpc.addOpenShellCredential = jest.fn().mockResolvedValue(ok(undefined));
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue(ok([single]));
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(ok(twoProfiles));
    });

    const change = async (fixture: ComponentFixture<unknown>, profileId: string) => {
      await (fixture.componentInstance as any).changePermission(single, profileId);
      await settle(fixture);
    };

    it("offers a select for a managed single-binding credential with two eligible profiles", async () => {
      const fixture = await render();
      const element = select(fixture);
      expect(element).not.toBeNull();
      expect(Array.from(element!.options).map((o) => o.value)).toEqual(["github", "gitlab"]);
      expect(element!.value).toBe("github");
    });

    it("shows plain text for an unmanaged provider", async () => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue(ok([unmanaged]));
      const fixture = await render();
      expect(select(fixture, "legacy")).toBeNull();
    });

    it("shows plain text for a provider with several bindings", async () => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue(ok([managed]));
      const fixture = await render();
      expect(select(fixture)).toBeNull();
      expect(qa(fixture, '[data-testid="openshell-credential-row"]')).toHaveLength(1);
    });

    it("shows plain text when only one profile is eligible", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(ok([twoProfiles[0]]));
      const fixture = await render();
      expect(select(fixture)).toBeNull();
    });

    it("does not count a profile with two required credentials", async () => {
      const heavy = {
        ...twoProfiles[1],
        credentials: [
          { name: "a", description: "", envVars: ["A"], required: true },
          { name: "b", description: "", envVars: ["B"], required: true },
        ],
      };
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(ok([twoProfiles[0], heavy]));
      const fixture = await render();
      expect(select(fixture)).toBeNull();
    });

    it("does nothing when the confirmation is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const fixture = await render();
      await change(fixture, "gitlab");
      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
      expect(agentAccessIpc.addOpenShellCredential).not.toHaveBeenCalled();
      expect(agentAccessIpc.removeOpenShellCredential).not.toHaveBeenCalled();
    });

    it("does nothing when the same permission is chosen again", async () => {
      const fixture = await render();
      await change(fixture, "github");
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(agentAccessIpc.addOpenShellCredential).not.toHaveBeenCalled();
    });

    it("adds under the new permission first, then removes the old provider with its definition", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const order: string[] = [];
      agentAccessIpc.addOpenShellCredential.mockImplementation(async () => {
        order.push("add");
        return ok(undefined);
      });
      agentAccessIpc.removeOpenShellCredential.mockImplementation(async () => {
        order.push("remove");
        return ok(undefined);
      });
      const fixture = await render();
      await change(fixture, "gitlab");
      expect(order).toEqual(["add", "remove"]);
      expect(agentAccessIpc.addOpenShellCredential).toHaveBeenCalledWith({
        sandboxName: "sb1",
        profileId: "gitlab",
        bindings: [{ ...single.bindings[0], envVar: "GITLAB_TOKEN" }],
      });
      expect(agentAccessIpc.removeOpenShellCredential).toHaveBeenCalledWith({
        sandboxName: "sb1",
        providerName: "github-sb1",
        deleteProvider: true,
      });
    });

    it("keeps the old env var when the new profile names none", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(
        ok([twoProfiles[0], profile("gitlab", "GitLab API", [])]),
      );
      const fixture = await render();
      await change(fixture, "gitlab");
      expect(agentAccessIpc.addOpenShellCredential.mock.calls[0][0].bindings[0].envVar).toBe(
        "GITHUB_TOKEN",
      );
    });

    it("reloads the list and starts waiting for the sandbox to apply the change", async () => {
      jest.useFakeTimers();
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();
      await change(fixture, "gitlab");
      expect(agentAccessIpc.listOpenShellCredentials.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(agentAccessIpc.getOpenShellApplyStatus).toHaveBeenCalled();
    });

    it("leaves the old provider alone and shows the error when the add fails", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      agentAccessIpc.addOpenShellCredential.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "profile rejected",
      });
      const fixture = await render();
      await change(fixture, "gitlab");
      expect(agentAccessIpc.removeOpenShellCredential).not.toHaveBeenCalled();
      expect(
        q(fixture, '[data-testid="openshell-credentials-action-error"]')?.textContent,
      ).toContain("profile rejected");
      expect(agentAccessIpc.listOpenShellCredentials.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(agentAccessIpc.getOpenShellApplyStatus).not.toHaveBeenCalled();
    });

    it("shows the error when removing the old provider fails after the add", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      agentAccessIpc.removeOpenShellCredential.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "could not delete old",
      });
      const fixture = await render();
      await change(fixture, "gitlab");
      expect(agentAccessIpc.addOpenShellCredential).toHaveBeenCalledTimes(1);
      expect(
        q(fixture, '[data-testid="openshell-credentials-action-error"]')?.textContent,
      ).toContain("could not delete old");
    });
  });

  describe("save as set (§M8.20 rule 17)", () => {
    const single: OpenShellSandboxCredential = {
      ...managed,
      bindings: [managed.bindings[0]],
    };
    const dialogClosing = (result: unknown) =>
      ({ closed: of(result) }) as unknown as ReturnType<DialogService["open"]>;
    const saveButton = (fixture: ComponentFixture<unknown>) =>
      q(fixture, "#agent-access-openshell-credentials_button_save-set");

    it("offers Save as set only when a secret this app created can be kept", async () => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue(ok([single, unmanaged]));
      const withOne = await render();
      expect(saveButton(withOne)).not.toBeNull();

      TestBed.resetTestingModule();
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue(ok([unmanaged]));
      const onlyUnmanaged = await render();
      expect(saveButton(onlyUnmanaged)).toBeNull();

      TestBed.resetTestingModule();
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue(ok([managed]));
      const multiBinding = await render();
      expect(saveButton(multiBinding)).toBeNull();
    });

    it("names the set, saves ids and names only, and confirms", async () => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue(ok([single, unmanaged]));
      agentAccessIpc.saveOpenShellSecretSet = jest.fn(async (request: any) =>
        ok({ id: "s", name: request.name, secrets: request.secrets }),
      );
      dialogService.open.mockReturnValue(dialogClosing(true));
      const fixture = await render();
      await (fixture.componentInstance as any).saveAsSet();

      const [component, config] = dialogService.open.mock.calls[0] as any[];
      expect(component).toBe(AgentAccessOpenShellSetNameDialogComponent);
      expect(config.data.titleKey).toBe("agentAccessOsSetSaveTitle");
      expect(config.data.initialName).toBe("");

      await config.data.save("Work");
      expect(agentAccessIpc.saveOpenShellSecretSet).toHaveBeenCalledWith({
        name: "Work",
        secrets: [
          {
            resourceType: "item",
            id: ITEM_ID,
            field: "password",
            label: "GitHub",
            profileId: "github",
            envVar: "GITHUB_TOKEN",
          },
        ],
      });
      await (fixture.componentInstance as any).saveAsSet();
      fixture.detectChanges();
      const notice = q(fixture, '[data-testid="openshell-credentials-set-notice"]')?.textContent;
      expect(notice).toContain("agentAccessOsSetSaved");
      expect(notice).toContain("agentAccessOsSetSavedSkipped");
    });

    it("shows no confirmation when the dialog is cancelled", async () => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue(ok([single]));
      dialogService.open.mockReturnValue(dialogClosing(undefined));
      const fixture = await render();
      await (fixture.componentInstance as any).saveAsSet();
      fixture.detectChanges();
      expect(q(fixture, '[data-testid="openshell-credentials-set-notice"]')).toBeNull();
    });
  });
});
