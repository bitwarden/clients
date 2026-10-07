import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";

import { OpenShellEnvironment, OpenShellSecretSet } from "../models/openshell-environments";

import { AgentAccessOpenShellEnvironmentDialogComponent } from "./agent-access-openshell-environment-dialog.component";
import { AgentAccessOpenShellEnvironmentsComponent } from "./agent-access-openshell-environments.component";
import { AgentAccessOpenShellSetNameDialogComponent } from "./agent-access-openshell-set-name-dialog.component";

const SET_ID = "3e9c8041-6f5d-4aa1-8c43-dd44ee55ff66";
const ENV_ID = "0b6f5d1e-3c2a-4d7e-9f10-aa11bb22cc33";
const ref = {
  resourceType: "secret" as const,
  id: "1c7a6e2f-4d3b-4e8f-8a21-bb22cc33dd44",
  field: "value" as const,
  label: "GitHub",
  profileId: "github",
  envVar: "GH_TOKEN",
};
const set: OpenShellSecretSet = { id: SET_ID, name: "Work", secrets: [ref] };
const environment: OpenShellEnvironment = {
  id: ENV_ID,
  name: "Dev",
  description: "Daily driver",
  from: "ghcr.io/acme/base:1",
  cpu: "2",
  memory: "4Gi",
  secretSetId: SET_ID,
};

describe("AgentAccessOpenShellEnvironmentsComponent (§M8.20 rule 17)", () => {
  let ipcMock: Record<string, jest.Mock>;
  let originalIpc: unknown;
  let dialogService: ReturnType<typeof mock<DialogService>>;

  beforeAll(() => {
    (global as any).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    (global as any).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    ipcMock = {
      listOpenShellEnvironments: jest.fn().mockResolvedValue({ ok: true, data: [environment] }),
      listOpenShellSecretSets: jest.fn().mockResolvedValue({ ok: true, data: [set] }),
      deleteOpenShellEnvironment: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
      deleteOpenShellSecretSet: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
      saveOpenShellSecretSet: jest.fn().mockResolvedValue({ ok: true, data: set }),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: ipcMock };
    dialogService = mock<DialogService>();
  });
  afterEach(() => {
    (global as any).ipc = originalIpc;
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  async function render(): Promise<ComponentFixture<AgentAccessOpenShellEnvironmentsComponent>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string, p1?: string | number) =>
      p1 === undefined ? key : `${key}|${p1}`,
    );
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellEnvironmentsComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: DialogService, useValue: dialogService },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellEnvironmentsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const q = (f: ComponentFixture<unknown>, selector: string) =>
    el(f).querySelector<HTMLElement>(selector);
  const all = (f: ComponentFixture<unknown>, selector: string) =>
    Array.from(el(f).querySelectorAll<HTMLElement>(selector));
  const comp = (f: ComponentFixture<unknown>) => f.componentInstance as any;
  const dialogClosing = (result: unknown) =>
    ({ closed: of(result) }) as unknown as ReturnType<DialogService["open"]>;

  it("lists environments and sets with their details", async () => {
    const fixture = await render();
    const rows = all(fixture, '[data-testid="agent-access-openshell-environment-row"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Dev");
    expect(rows[0].textContent).toContain("Daily driver");
    expect(rows[0].textContent).toContain("ghcr.io/acme/base:1");
    expect(rows[0].textContent).toContain("2 / 4Gi");
    expect(rows[0].querySelector('[data-testid="environment-secrets"]')?.textContent).toContain(
      "Work",
    );
    const setRows = all(fixture, '[data-testid="agent-access-openshell-set-row"]');
    expect(setRows).toHaveLength(1);
    expect(setRows[0].querySelector('[data-testid="set-secret-count"]')?.textContent).toBe("1");
  });

  it("renders names as text, never markup", async () => {
    ipcMock.listOpenShellEnvironments.mockResolvedValue({
      ok: true,
      data: [{ ...environment, name: "<img src=x onerror=alert(1)>" }],
    });
    const fixture = await render();
    expect(q(fixture, "img")).toBeNull();
    expect(el(fixture).textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("shows how an environment's secrets are kept", async () => {
    ipcMock.listOpenShellEnvironments.mockResolvedValue({
      ok: true,
      data: [
        { ...environment, id: "a", secretSetId: undefined, secrets: [ref, ref] },
        { ...environment, id: "b", secretSetId: "9f9f9f9f-0000-4000-8000-000000000000" },
        { ...environment, id: "c", secretSetId: undefined },
      ],
    });
    const fixture = await render();
    const text = all(fixture, '[data-testid="environment-secrets"]').map((c) => c.textContent);
    expect(text[0]).toContain("agentAccessOsEnvSecretsInline|2");
    expect(text[1]).toContain("agentAccessOsEnvSetMissing");
    expect(text[2]?.trim()).toBe("");
  });

  it("shows the empty state, and the set hint, when there is nothing", async () => {
    ipcMock.listOpenShellEnvironments.mockResolvedValue({ ok: true, data: [] });
    ipcMock.listOpenShellSecretSets.mockResolvedValue({ ok: true, data: [] });
    const fixture = await render();
    expect(q(fixture, '[data-testid="agent-access-openshell-environments-empty"]')).not.toBeNull();
    expect(q(fixture, '[data-testid="agent-access-openshell-sets-empty"]')).not.toBeNull();
  });

  it("shows an unsupported state with a retry, and no data", async () => {
    ipcMock.listOpenShellEnvironments.mockResolvedValue({ ok: false, error: "unsupported" });
    const fixture = await render();
    const error = q(fixture, '[data-testid="agent-access-openshell-environments-error"]');
    expect(error?.getAttribute("data-error")).toBe("unsupported");
    expect(all(fixture, '[data-testid="agent-access-openshell-environment-row"]')).toHaveLength(0);
    ipcMock.listOpenShellEnvironments.mockResolvedValue({ ok: true, data: [environment] });
    q(fixture, "#agent-access-openshell-environments_button_retry")!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(all(fixture, '[data-testid="agent-access-openshell-environment-row"]')).toHaveLength(1);
  });

  it("opens the dialog for a new environment and reloads when it saves", async () => {
    dialogService.open.mockReturnValue(dialogClosing(environment));
    const fixture = await render();
    await comp(fixture).newEnvironment();
    expect(dialogService.open).toHaveBeenCalledWith(
      AgentAccessOpenShellEnvironmentDialogComponent,
      { data: { environment: undefined, sets: [set], inlineSecrets: undefined } },
    );
    expect(ipcMock.listOpenShellEnvironments).toHaveBeenCalledTimes(2);
  });

  it("does not reload when the dialog is cancelled", async () => {
    dialogService.open.mockReturnValue(dialogClosing(undefined));
    const fixture = await render();
    await comp(fixture).newEnvironment();
    expect(ipcMock.listOpenShellEnvironments).toHaveBeenCalledTimes(1);
  });

  it("edits with the environment's own inline secrets", async () => {
    dialogService.open.mockReturnValue(dialogClosing(undefined));
    const inline = { ...environment, secretSetId: undefined, secrets: [ref] };
    const fixture = await render();
    await comp(fixture).edit(inline);
    expect(dialogService.open.mock.calls[0][1]).toEqual({
      data: { environment: inline, sets: [set], inlineSecrets: [ref] },
    });
  });

  describe("delete", () => {
    it("confirms, deletes by id and reloads", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();
      await comp(fixture).delete(environment);
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "danger",
          content: expect.objectContaining({ placeholders: ["Dev"] }),
        }),
      );
      expect(ipcMock.deleteOpenShellEnvironment).toHaveBeenCalledWith({ id: ENV_ID });
      expect(ipcMock.listOpenShellEnvironments).toHaveBeenCalledTimes(2);
    });

    it("does nothing when not confirmed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const fixture = await render();
      await comp(fixture).delete(environment);
      expect(ipcMock.deleteOpenShellEnvironment).not.toHaveBeenCalled();
    });

    it("shows main's message when a set is still in use", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      ipcMock.deleteOpenShellSecretSet.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "This set is used by 1 environment.",
      });
      const fixture = await render();
      await comp(fixture).deleteSet(set);
      fixture.detectChanges();
      expect(
        q(fixture, '[data-testid="agent-access-openshell-environments-action-error"]')?.textContent,
      ).toContain("This set is used by 1 environment.");
      expect(ipcMock.deleteOpenShellSecretSet).toHaveBeenCalledWith({ id: SET_ID });
    });
  });

  it("renames a set through the name dialog, keeping its secrets", async () => {
    dialogService.open.mockReturnValue(dialogClosing(true));
    const fixture = await render();
    await comp(fixture).renameSet(set);
    const [component, config] = dialogService.open.mock.calls[0] as any[];
    expect(component).toBe(AgentAccessOpenShellSetNameDialogComponent);
    expect(config.data.initialName).toBe("Work");
    await config.data.save("Team");
    expect(ipcMock.saveOpenShellSecretSet).toHaveBeenCalledWith({
      id: SET_ID,
      name: "Team",
      secrets: [ref],
    });
    expect(ipcMock.listOpenShellSecretSets).toHaveBeenCalledTimes(2);
  });
});
