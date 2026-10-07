import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { OpenShellManagementResult, OpenShellSandbox } from "../models/openshell-management";

import { AgentAccessOpenShellEnvironmentDialogComponent } from "./agent-access-openshell-environment-dialog.component";
import { AgentAccessOpenShellSandboxComponent } from "./agent-access-openshell-sandbox.component";

const ready: OpenShellSandbox = {
  name: "alpha",
  id: "id-alpha",
  phase: "Ready",
  createdAt: "2026-10-07T08:00:00Z",
  providerCount: 2,
};
const stopped: OpenShellSandbox = { ...ready, phase: "Stopped", providerCount: null };
const provisioning: OpenShellSandbox = { ...ready, phase: "Provisioning" };

const okList = (data: OpenShellSandbox[]): OpenShellManagementResult<OpenShellSandbox[]> => ({
  ok: true,
  data,
});

describe("AgentAccessOpenShellSandboxComponent (§M8.20)", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let originalIpc: unknown;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let navigate: jest.SpyInstance;
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeAll(() => {
    (global as any).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    (global as any).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    agentAccessIpc = {
      listOpenShellSandboxes: jest.fn().mockResolvedValue(okList([ready])),
      openShellSandboxAction: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };
    dialogService = mock<DialogService>();
    paramMap = new BehaviorSubject(convertToParamMap({ name: "alpha" }));
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    jest.useRealTimers();
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  async function render(
    fakeTimers = false,
  ): Promise<ComponentFixture<AgentAccessOpenShellSandboxComponent>> {
    if (fakeTimers) {
      jest.useFakeTimers();
    }
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellSandboxComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap, snapshot: { paramMap: paramMap.value } },
        },
        { provide: I18nService, useValue: i18n },
        { provide: DialogService, useValue: dialogService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
      ],
    });
    navigate = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
    const fixture = TestBed.createComponent(AgentAccessOpenShellSandboxComponent);
    fixture.detectChanges();
    if (fakeTimers) {
      await jest.advanceTimersByTimeAsync(0);
    } else {
      await fixture.whenStable();
    }
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
  const q = (fixture: ComponentFixture<unknown>, selector: string) =>
    el(fixture).querySelector<HTMLElement>(selector);
  const click = async (fixture: ComponentFixture<unknown>, selector: string) => {
    const target = q(fixture, selector);
    expect(target).not.toBeNull();
    target!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  describe("states", () => {
    it("shows a skeleton while the first read is pending", async () => {
      let resolve!: (value: unknown) => void;
      agentAccessIpc.listOpenShellSandboxes.mockReturnValue(new Promise((r) => (resolve = r)));
      const fixture = await render();

      expect(q(fixture, '[data-testid="agent-access-openshell-sandbox-loading"]')).not.toBeNull();

      resolve(okList([ready]));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(q(fixture, '[data-testid="agent-access-openshell-sandbox-loading"]')).toBeNull();
      expect(q(fixture, '[data-testid="sandbox-title"]')).not.toBeNull();
    });

    it("shows not-found when the sandbox is not in the list", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(
        okList([{ ...ready, name: "other" }]),
      );
      const fixture = await render();

      expect(q(fixture, '[data-testid="agent-access-openshell-sandbox-not-found"]')).not.toBeNull();
      expect(q(fixture, '[data-testid="sandbox-title"]')).toBeNull();
    });

    it("shows the error with Retry, and Retry re-reads", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValueOnce({
        ok: false,
        error: "gatewayUnreachable",
        message: "connection refused",
      });
      const fixture = await render();

      const callout = q(fixture, '[data-testid="agent-access-openshell-sandbox-error"]');
      expect(callout?.textContent).toContain("agentAccessOsPageErrorGatewayUnreachable");
      expect(callout?.textContent).toContain("connection refused");

      await click(fixture, "#agent-access-openshell-sandbox_button_retry");

      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(2);
      expect(q(fixture, '[data-testid="sandbox-title"]')?.textContent).toContain("alpha");
    });

    it("shows the name, the phase badge and the secret count", async () => {
      const fixture = await render();

      expect(q(fixture, '[data-testid="sandbox-title"]')?.textContent).toContain("alpha");
      expect(q(fixture, '[data-testid="phase-badge"]')?.textContent).toContain("Ready");
      expect(el(fixture).textContent).toContain("agentAccessOsTabSecrets");
      expect(el(fixture).textContent).toContain("agentAccessOsTabPermissions");
      expect(el(fixture).querySelector("bit-tab-link [slot=end]")?.textContent?.trim()).toBe("2");
    });

    it("omits the count when it is unknown", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([stopped]));
      const fixture = await render();

      expect(el(fixture).querySelector("bit-tab-link [slot=end]")).toBeNull();
    });

    it("has a Ports tab that shows how many forwards the sandbox has", async () => {
      agentAccessIpc.listOpenShellForwards = jest
        .fn()
        .mockResolvedValue({ ok: true, data: [{ port: 8080 }, { port: 9090 }, { port: 1 }] });
      const fixture = await render();

      expect(agentAccessIpc.listOpenShellForwards).toHaveBeenCalledWith({ sandboxName: "alpha" });
      const ports = Array.from(el(fixture).querySelectorAll("bit-tab-link")).find((link) =>
        link.textContent?.includes("agentAccessOsTabPorts"),
      );
      expect(ports?.querySelector("[slot=end]")?.textContent?.trim()).toBe("3");
    });

    it("shows the primary Open button for a ready sandbox", async () => {
      const fixture = await render();

      expect(q(fixture, '[data-testid="openshell-open"]')).not.toBeNull();
    });
  });

  describe("actions", () => {
    it("offers Stop only when ready", async () => {
      const fixture = await render();

      expect(q(fixture, "#agent-access-openshell-sandbox_button_stop")).not.toBeNull();
      expect(q(fixture, "#agent-access-openshell-sandbox_button_start")).toBeNull();
    });

    it("offers Start only when stopped", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([stopped]));
      const fixture = await render();

      expect(q(fixture, "#agent-access-openshell-sandbox_button_start")).not.toBeNull();
      expect(q(fixture, "#agent-access-openshell-sandbox_button_stop")).toBeNull();
    });

    it("stops a sandbox, then re-lists", async () => {
      const fixture = await render();
      agentAccessIpc.listOpenShellSandboxes.mockClear();
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([stopped]));

      await click(fixture, "#agent-access-openshell-sandbox_button_stop");

      expect(agentAccessIpc.openShellSandboxAction).toHaveBeenCalledWith({
        action: "stop",
        name: "alpha",
      });
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(1);
      expect(q(fixture, "#agent-access-openshell-sandbox_button_start")).not.toBeNull();
    });

    it("starts a sandbox, then re-lists", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([stopped]));
      const fixture = await render();
      agentAccessIpc.listOpenShellSandboxes.mockClear();
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([ready]));

      await click(fixture, "#agent-access-openshell-sandbox_button_start");

      expect(agentAccessIpc.openShellSandboxAction).toHaveBeenCalledWith({
        action: "start",
        name: "alpha",
      });
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(1);
    });

    it("deletes after confirmation, then goes back to the list", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();

      await click(fixture, "#agent-access-openshell-sandbox_button_delete");

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          content: { key: "agentAccessOsPageDeleteContent", placeholders: ["alpha"] },
        }),
      );
      expect(agentAccessIpc.openShellSandboxAction).toHaveBeenCalledWith({
        action: "delete",
        name: "alpha",
      });
      expect(navigate).toHaveBeenCalledWith(["/agent-access/openshell"]);
    });

    it("sends nothing when the delete confirmation is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const fixture = await render();

      await click(fixture, "#agent-access-openshell-sandbox_button_delete");

      expect(agentAccessIpc.openShellSandboxAction).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("stays on the page when delete fails, and shows the scrubbed message", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      agentAccessIpc.openShellSandboxAction.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "scrubbed failure",
      });
      const fixture = await render();

      await click(fixture, "#agent-access-openshell-sandbox_button_delete");

      expect(navigate).not.toHaveBeenCalled();
      expect(
        q(fixture, '[data-testid="agent-access-openshell-sandbox-action-error"]')?.textContent,
      ).toContain("scrubbed failure");
    });

    it("shows the failure of a stop and still re-lists", async () => {
      agentAccessIpc.openShellSandboxAction.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "scrubbed failure",
      });
      const fixture = await render();
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await click(fixture, "#agent-access-openshell-sandbox_button_stop");

      expect(
        q(fixture, '[data-testid="agent-access-openshell-sandbox-action-error"]')?.textContent,
      ).toContain("scrubbed failure");
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(1);
    });

    it("falls back to a generic message when a failure carries none", async () => {
      agentAccessIpc.openShellSandboxAction.mockResolvedValue({ ok: false, error: "failed" });
      const fixture = await render();

      await click(fixture, "#agent-access-openshell-sandbox_button_stop");

      expect(
        q(fixture, '[data-testid="agent-access-openshell-sandbox-action-error"]')?.textContent,
      ).toContain("agentAccessOsPageErrorFailed");
    });
  });

  describe("polling", () => {
    it("does not poll when the sandbox is Ready", async () => {
      await render(true);
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await jest.advanceTimersByTimeAsync(20_000);

      expect(agentAccessIpc.listOpenShellSandboxes).not.toHaveBeenCalled();
    });

    it("polls every 5 s while provisioning, and stops once it settles", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([provisioning]));
      await render(true);
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await jest.advanceTimersByTimeAsync(4_999);
      expect(agentAccessIpc.listOpenShellSandboxes).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(1);

      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([ready]));
      await jest.advanceTimersByTimeAsync(5_000);
      agentAccessIpc.listOpenShellSandboxes.mockClear();
      await jest.advanceTimersByTimeAsync(20_000);

      expect(agentAccessIpc.listOpenShellSandboxes).not.toHaveBeenCalled();
    });

    it("stops polling when destroyed", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([provisioning]));
      const fixture = await render(true);
      fixture.destroy();
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await jest.advanceTimersByTimeAsync(20_000);

      expect(agentAccessIpc.listOpenShellSandboxes).not.toHaveBeenCalled();
    });
  });

  describe("Requests tab badge (§M8.20 rule 16)", () => {
    it("reads the pending requests once and badges the tab with the count", async () => {
      agentAccessIpc.listOpenShellRequests = jest
        .fn()
        .mockResolvedValue({ ok: true, data: [{ id: "a" }, { id: "b" }] });
      const fixture = await render();

      expect(agentAccessIpc.listOpenShellRequests).toHaveBeenCalledWith({
        sandboxName: "alpha",
        status: "pending",
      });
      expect(q(fixture, '[data-testid="requests-badge"]')?.textContent?.trim()).toBe("2");
    });

    it("shows no badge when nothing is waiting or the read fails", async () => {
      agentAccessIpc.listOpenShellRequests = jest.fn().mockResolvedValue({ ok: true, data: [] });
      const empty = await render();
      expect(q(empty, '[data-testid="requests-badge"]')).toBeNull();

      TestBed.resetTestingModule();
      agentAccessIpc.listOpenShellRequests = jest
        .fn()
        .mockResolvedValue({ ok: false, error: "failed" });
      const failed = await render();
      expect(q(failed, '[data-testid="requests-badge"]')).toBeNull();
    });
  });

  describe("details and environments (§M8.20 rule 17)", () => {
    const refId = "1c7a6e2f-4d3b-4e8f-8a21-bb22cc33dd44";
    const managedCredential = {
      providerName: "github-alpha",
      profileId: "github",
      managed: true,
      bindings: [
        { envVar: "GH_TOKEN", resourceType: "secret", id: refId, field: "value", label: "GitHub" },
      ],
    };
    const unmanagedCredential = {
      providerName: "other",
      profileId: "x",
      managed: false,
      bindings: [],
    };
    const dialogClosing = (result: unknown) =>
      ({ closed: of(result) }) as unknown as ReturnType<DialogService["open"]>;

    beforeEach(() => {
      agentAccessIpc.getOpenShellSandboxMeta = jest.fn().mockResolvedValue({
        ok: true,
        data: [
          { name: "alpha", purpose: "CI <i>runner</i>", color: "blue" },
          { name: "beta", purpose: "not mine", color: "red" },
        ],
      });
      agentAccessIpc.setOpenShellSandboxMeta = jest
        .fn()
        .mockResolvedValue({ ok: true, data: undefined });
      agentAccessIpc.listOpenShellCredentials = jest
        .fn()
        .mockResolvedValue({ ok: true, data: [managedCredential, unmanagedCredential] });
      agentAccessIpc.listOpenShellSecretSets = jest.fn().mockResolvedValue({ ok: true, data: [] });
    });

    it("shows this sandbox's purpose as text and its accent color under the title", async () => {
      const fixture = await render();
      const purpose = q(fixture, '[data-testid="sandbox-purpose"]');
      expect(purpose?.textContent).toContain("CI <i>runner</i>");
      expect(purpose?.querySelector("i")).toBeNull();
      expect(q(fixture, '[data-testid="sandbox-accent"]')?.className).toContain(
        "tw-bg-primary-600",
      );
    });

    it("shows nothing when the sandbox has no details or they cannot be read", async () => {
      agentAccessIpc.getOpenShellSandboxMeta.mockResolvedValue({ ok: true, data: [] });
      const none = await render();
      expect(q(none, '[data-testid="sandbox-purpose"]')).toBeNull();
      expect(q(none, '[data-testid="sandbox-accent"]')).toBeNull();

      TestBed.resetTestingModule();
      agentAccessIpc.getOpenShellSandboxMeta.mockRejectedValue(new Error("boom"));
      const failed = await render();
      expect(q(failed, '[data-testid="sandbox-title"]')).not.toBeNull();
      expect(q(failed, '[data-testid="sandbox-purpose"]')).toBeNull();
    });

    it("has Edit details and Save as environment in the header menu", async () => {
      const fixture = await render();
      expect(q(fixture, "#agent-access-openshell-sandbox_button_options")).not.toBeNull();
    });

    it("Edit details opens the dialog with the current details and shows what was saved", async () => {
      dialogService.open.mockReturnValue(
        dialogClosing({ name: "alpha", purpose: "Edited", color: "amber" }),
      );
      const fixture = await render();
      await (fixture.componentInstance as any).editDetails();
      fixture.detectChanges();

      const [, config] = dialogService.open.mock.calls[0] as any[];
      expect(config.data).toEqual({
        sandboxName: "alpha",
        meta: { name: "alpha", purpose: "CI <i>runner</i>", color: "blue" },
      });
      expect(q(fixture, '[data-testid="sandbox-purpose"]')?.textContent).toContain("Edited");
      expect(q(fixture, '[data-testid="sandbox-accent"]')?.className).toContain(
        "tw-bg-warning-600",
      );
    });

    it("clearing the details removes the line and the accent, and cancelling changes nothing", async () => {
      const fixture = await render();
      dialogService.open.mockReturnValueOnce(dialogClosing(undefined));
      await (fixture.componentInstance as any).editDetails();
      fixture.detectChanges();
      expect(q(fixture, '[data-testid="sandbox-purpose"]')).not.toBeNull();

      dialogService.open.mockReturnValueOnce(dialogClosing(null));
      await (fixture.componentInstance as any).editDetails();
      fixture.detectChanges();
      expect(q(fixture, '[data-testid="sandbox-purpose"]')).toBeNull();
      expect(q(fixture, '[data-testid="sandbox-accent"]')).toBeNull();
    });

    it("Save as environment offers this app's secrets, counts the rest as skipped, and confirms", async () => {
      dialogService.open.mockReturnValue(dialogClosing({ id: "e", name: "alpha-env" }));
      const fixture = await render();
      await (fixture.componentInstance as any).saveAsEnvironment();
      fixture.detectChanges();

      expect(agentAccessIpc.listOpenShellCredentials).toHaveBeenCalledWith({
        sandboxName: "alpha",
      });
      const [component, config] = dialogService.open.mock.calls[0] as any[];
      expect(component).toBe(AgentAccessOpenShellEnvironmentDialogComponent);
      expect(config.data).toEqual({
        sets: [],
        inlineSecrets: [
          {
            resourceType: "secret",
            id: refId,
            field: "value",
            label: "GitHub",
            profileId: "github",
            envVar: "GH_TOKEN",
          },
        ],
        skippedSecrets: 1,
        prefill: { name: "alpha", description: "CI <i>runner</i>" },
      });
      expect(
        q(fixture, '[data-testid="agent-access-openshell-sandbox-notice"]')?.textContent,
      ).toContain("agentAccessOsEnvSaved");
    });

    it("shows the error and opens no dialog when the secrets cannot be read", async () => {
      agentAccessIpc.listOpenShellCredentials.mockResolvedValue({
        ok: false,
        error: "gatewayUnreachable",
        message: "scrubbed",
      });
      const fixture = await render();
      await (fixture.componentInstance as any).saveAsEnvironment();
      fixture.detectChanges();
      expect(dialogService.open).not.toHaveBeenCalled();
      expect(
        q(fixture, '[data-testid="agent-access-openshell-sandbox-action-error"]')?.textContent,
      ).toContain("scrubbed");
    });

    it("clears the details after a successful delete, and not after a failed one", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();

      agentAccessIpc.openShellSandboxAction.mockResolvedValueOnce({ ok: false, error: "failed" });
      await (fixture.componentInstance as any).delete();
      expect(agentAccessIpc.setOpenShellSandboxMeta).not.toHaveBeenCalled();

      await (fixture.componentInstance as any).delete();
      expect(agentAccessIpc.setOpenShellSandboxMeta).toHaveBeenCalledWith({
        name: "alpha",
        purpose: "",
        color: null,
      });
      expect(navigate).toHaveBeenCalledWith(["/agent-access/openshell"]);
    });
  });
});
