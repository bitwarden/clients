import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, provideRouter, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { OpenShellManagementResult, OpenShellSandbox } from "../models/openshell-management";

import { AgentAccessOpenShellCreateSandboxDialogComponent } from "./agent-access-openshell-create-sandbox-dialog.component";
import { AgentAccessOpenShellPageComponent } from "./agent-access-openshell-page.component";

const ready: OpenShellSandbox = {
  name: "alpha",
  id: "id-alpha",
  phase: "Ready",
  createdAt: "2026-10-07T08:00:00Z",
  providerCount: 2,
};
const stopped: OpenShellSandbox = {
  name: "beta",
  id: "id-beta",
  phase: "Stopped",
  createdAt: "not a date",
  providerCount: null,
};
const provisioning: OpenShellSandbox = {
  name: "gamma",
  id: "id-gamma",
  phase: "Provisioning",
  createdAt: "2026-10-07T09:00:00Z",
  providerCount: 0,
};

const okList = (data: OpenShellSandbox[]): OpenShellManagementResult<OpenShellSandbox[]> => ({
  ok: true,
  data,
});

describe("AgentAccessOpenShellPageComponent (§M8.20)", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let originalIpc: unknown;
  let dialogService: ReturnType<typeof mock<DialogService>>;
  let router: Router;
  let route: ActivatedRoute;

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
      listOpenShellSandboxes: jest.fn().mockResolvedValue(okList([ready, stopped])),
      openShellSandboxAction: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
      getOpenShellSandboxMeta: jest.fn().mockResolvedValue({ ok: true, data: [] }),
      setOpenShellSandboxMeta: jest.fn().mockResolvedValue({ ok: true, data: undefined }),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };
    dialogService = mock<DialogService>();
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    jest.useRealTimers();
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  /**
   * With fake timers an open polling interval keeps `whenStable()` pending forever, so the first
   * read is settled by advancing the fake clock instead.
   */
  async function render(
    fakeTimers = false,
  ): Promise<ComponentFixture<AgentAccessOpenShellPageComponent>> {
    if (fakeTimers) {
      jest.useFakeTimers();
    }
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string, p1?: string | number) =>
      p1 === undefined ? key : `${key}|${p1}`,
    );
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellPageComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: DialogService, useValue: dialogService },
        provideRouter([]),
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
      ],
    });
    router = TestBed.inject(Router);
    route = TestBed.inject(ActivatedRoute);
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    const fixture = TestBed.createComponent(AgentAccessOpenShellPageComponent);
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

  const act = async (
    fixture: ComponentFixture<unknown>,
    method: "start" | "stop" | "delete",
    sandbox: OpenShellSandbox,
  ) => {
    await (fixture.componentInstance as any)[method](sandbox);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  describe("states", () => {
    it("shows a skeleton while the first read is pending", async () => {
      let resolve!: (value: unknown) => void;
      agentAccessIpc.listOpenShellSandboxes.mockReturnValue(new Promise((r) => (resolve = r)));
      const fixture = await render();

      expect(q(fixture, '[data-testid="agent-access-openshell-loading"]')).not.toBeNull();
      expect(q(fixture, '[data-testid="agent-access-openshell-list"]')).toBeNull();

      resolve(okList([ready]));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(q(fixture, '[data-testid="agent-access-openshell-loading"]')).toBeNull();
      expect(q(fixture, '[data-testid="agent-access-openshell-list"]')).not.toBeNull();
    });

    it("shows the empty state with a Create sandbox button", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([]));
      const fixture = await render();

      expect(q(fixture, '[data-testid="agent-access-openshell-empty"]')).not.toBeNull();
      expect(q(fixture, "#agent-access-openshell-page_button_create-empty")).not.toBeNull();
    });

    it.each([
      ["cliMissing", "agentAccessOsPageErrorCliMissing"],
      ["gatewayUnreachable", "agentAccessOsPageErrorGatewayUnreachable"],
      ["unsupported", "agentAccessOsPageErrorUnsupported"],
      ["failed", "agentAccessOsPageErrorFailed"],
    ] as const)("shows the %s error with Retry", async (error, key) => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValueOnce({
        ok: false,
        error,
        message: error === "failed" ? "boom happened" : undefined,
      });
      const fixture = await render();

      const callout = q(fixture, '[data-testid="agent-access-openshell-error"]');
      expect(callout?.getAttribute("data-error")).toBe(error);
      expect(callout?.textContent).toContain(key);
      if (error === "failed") {
        expect(callout?.textContent).toContain("boom happened");
      }

      await click(fixture, "#agent-access-openshell-page_button_retry");
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(2);
      expect(q(fixture, '[data-testid="agent-access-openshell-error"]')).toBeNull();
      expect(q(fixture, '[data-testid="agent-access-openshell-list"]')).not.toBeNull();
    });

    it("renders rows with phase badge variants, created time and credential count", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(
        okList([ready, stopped, { ...provisioning, name: "delta", id: "d" }]),
      );
      const fixture = await render(true);

      const rows = Array.from(
        el(fixture).querySelectorAll('[data-testid="agent-access-openshell-row"]'),
      );
      expect(rows).toHaveLength(3);
      expect(rows[0].textContent).toContain("alpha");
      expect(rows[0].querySelector('[data-testid="secret-count"]')?.textContent?.trim()).toBe("2");
      // null providerCount shows nothing; an unparseable timestamp is shown verbatim.
      expect(rows[1].querySelector('[data-testid="secret-count"]')?.textContent?.trim()).toBe("");
      expect(rows[1].textContent).toContain("not a date");

      const component = fixture.componentInstance as any;
      expect(component.phaseVariant(ready)).toBe("success");
      expect(component.phaseVariant(stopped)).toBe("subtle");
      expect(component.phaseVariant(provisioning)).toBe("warning");
      expect(component.phaseVariant({ ...ready, phase: "Error" })).toBe("danger");
      expect(component.phaseVariant({ ...ready, phase: "Failed" })).toBe("danger");
    });

    it("offers Start only when stopped and Stop only when ready", async () => {
      const fixture = await render();
      const component = fixture.componentInstance as any;

      expect(component.isReady(ready)).toBe(true);
      expect(component.isStopped(ready)).toBe(false);
      expect(component.isStopped(stopped)).toBe(true);
      expect(component.isReady(stopped)).toBe(false);
    });

    it("links each row to its sandbox page", async () => {
      const fixture = await render();

      expect(q(fixture, "#agent-access-openshell-page_link_open-alpha")).not.toBeNull();
      expect(q(fixture, "#agent-access-openshell-page_link_open-beta")).not.toBeNull();
    });
  });

  describe("row actions", () => {
    it("starts a stopped sandbox, then re-lists", async () => {
      const fixture = await render();
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await act(fixture, "start", stopped);

      expect(agentAccessIpc.openShellSandboxAction).toHaveBeenCalledWith({
        action: "start",
        name: "beta",
      });
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(1);
    });

    it("stops a ready sandbox, then re-lists", async () => {
      const fixture = await render();
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await act(fixture, "stop", ready);

      expect(agentAccessIpc.openShellSandboxAction).toHaveBeenCalledWith({
        action: "stop",
        name: "alpha",
      });
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(1);
    });

    it("deletes after the user confirms, naming the workspace loss", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await act(fixture, "delete", ready);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "agentAccessOsPageDeleteTitle" },
          content: { key: "agentAccessOsPageDeleteContent", placeholders: ["alpha"] },
          type: "danger",
        }),
      );
      expect(agentAccessIpc.openShellSandboxAction).toHaveBeenCalledWith({
        action: "delete",
        name: "alpha",
      });
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(1);
    });

    it("sends nothing when the delete confirmation is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const fixture = await render();
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await act(fixture, "delete", ready);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);
      expect(agentAccessIpc.openShellSandboxAction).not.toHaveBeenCalled();
      expect(agentAccessIpc.listOpenShellSandboxes).not.toHaveBeenCalled();
    });

    it("disables that row's options button while its action runs", async () => {
      let finish!: (value: unknown) => void;
      agentAccessIpc.openShellSandboxAction.mockReturnValue(new Promise((r) => (finish = r)));
      const fixture = await render();

      const pending = act(fixture, "stop", ready);
      fixture.detectChanges();

      const options = q(fixture, "#agent-access-openshell-page_button_options-alpha");
      const other = q(fixture, "#agent-access-openshell-page_button_options-beta");
      expect(options?.getAttribute("aria-disabled")).toBe("true");
      expect(other?.getAttribute("aria-disabled")).not.toBe("true");

      finish({ ok: true, data: undefined });
      await pending;
      expect(
        q(fixture, "#agent-access-openshell-page_button_options-alpha")?.getAttribute(
          "aria-disabled",
        ),
      ).not.toBe("true");
    });

    it("shows the scrubbed message of a failed action and still re-lists", async () => {
      agentAccessIpc.openShellSandboxAction.mockResolvedValue({
        ok: false,
        error: "failed",
        message: "scrubbed: sandbox busy",
      });
      const fixture = await render();
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await act(fixture, "stop", ready);

      expect(
        q(fixture, '[data-testid="agent-access-openshell-action-error"]')?.textContent,
      ).toContain("scrubbed: sandbox busy");
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(1);
    });

    it("falls back to a generic message when a failure carries none", async () => {
      agentAccessIpc.openShellSandboxAction.mockResolvedValue({
        ok: false,
        error: "gatewayUnreachable",
      });
      const fixture = await render();

      await act(fixture, "stop", ready);

      expect(
        q(fixture, '[data-testid="agent-access-openshell-action-error"]')?.textContent,
      ).toContain("agentAccessOsPageErrorGatewayUnreachable");
    });
  });

  describe("create", () => {
    it("opens the page of the sandbox the dialog created", async () => {
      jest
        .spyOn(AgentAccessOpenShellCreateSandboxDialogComponent, "open")
        .mockReturnValue({ closed: of("delta") } as any);
      const fixture = await render();

      await click(fixture, "#agent-access-openshell-page_button_create");

      expect(router.navigate).toHaveBeenCalledWith(["delta"], { relativeTo: route });
    });

    it("does nothing when the dialog is cancelled", async () => {
      jest
        .spyOn(AgentAccessOpenShellCreateSandboxDialogComponent, "open")
        .mockReturnValue({ closed: of(undefined) } as any);
      const fixture = await render();

      await click(fixture, "#agent-access-openshell-page_button_create");

      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(1);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe("polling", () => {
    it("does not poll when every sandbox is Ready or Stopped", async () => {
      await render(true);
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await jest.advanceTimersByTimeAsync(20_000);

      expect(agentAccessIpc.listOpenShellSandboxes).not.toHaveBeenCalled();
    });

    it("polls every 5 s while a sandbox is provisioning, and stops once it settles", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([provisioning]));
      await render(true);
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      await jest.advanceTimersByTimeAsync(4_999);
      expect(agentAccessIpc.listOpenShellSandboxes).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(5_000);
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(2);

      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(
        okList([{ ...provisioning, phase: "Ready" }]),
      );
      await jest.advanceTimersByTimeAsync(5_000);
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(3);

      await jest.advanceTimersByTimeAsync(30_000);
      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(3);
    });

    it("stops polling when the page is destroyed", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([provisioning]));
      const fixture = await render(true);
      agentAccessIpc.listOpenShellSandboxes.mockClear();

      fixture.destroy();
      await jest.advanceTimersByTimeAsync(30_000);

      expect(agentAccessIpc.listOpenShellSandboxes).not.toHaveBeenCalled();
    });

    it("keeps the last list through a brief failure, then gives up after three in a row", async () => {
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue(okList([provisioning]));
      const fixture = await render(true);
      agentAccessIpc.listOpenShellSandboxes.mockClear();
      agentAccessIpc.listOpenShellSandboxes.mockResolvedValue({
        ok: false,
        error: "gatewayUnreachable",
      });

      await jest.advanceTimersByTimeAsync(5_000);
      expect((fixture.componentInstance as any).sandboxes()).not.toBeNull();

      await jest.advanceTimersByTimeAsync(60_000);

      expect(agentAccessIpc.listOpenShellSandboxes).toHaveBeenCalledTimes(3);
      expect((fixture.componentInstance as any).failure()).not.toBeNull();
    });
  });

  describe("environments switch and sandbox details (§M8.20 rule 17)", () => {
    it("shows the Sandboxes | Environments switch on the sandboxes view", async () => {
      const fixture = await render();
      expect(q(fixture, "app-agent-access-openshell-view-toggle")).not.toBeNull();
    });

    it("shows each sandbox's purpose under its name and an accent in its color", async () => {
      agentAccessIpc.getOpenShellSandboxMeta.mockResolvedValue({
        ok: true,
        data: [{ name: "alpha", purpose: "Nightly CI <b>runner</b>", color: "green" }],
      });
      const fixture = await render();

      const rows = Array.from(
        el(fixture).querySelectorAll('[data-testid="agent-access-openshell-row"]'),
      );
      const purpose = rows[0].querySelector('[data-testid="sandbox-purpose"]');
      expect(purpose?.textContent).toContain("Nightly CI <b>runner</b>");
      expect(purpose?.querySelector("b")).toBeNull();
      const accent = rows[0].querySelector('[data-testid="sandbox-accent"]');
      expect(accent?.className).toContain("tw-bg-success-600");
      expect(rows[1].querySelector('[data-testid="sandbox-purpose"]')).toBeNull();
      expect(rows[1].querySelector('[data-testid="sandbox-accent"]')).toBeNull();
    });

    it("shows a color without a purpose, and a purpose without a color", async () => {
      agentAccessIpc.getOpenShellSandboxMeta.mockResolvedValue({
        ok: true,
        data: [
          { name: "alpha", purpose: "", color: "red" },
          { name: "beta", purpose: "p", color: null },
        ],
      });
      const fixture = await render();
      const rows = Array.from(
        el(fixture).querySelectorAll('[data-testid="agent-access-openshell-row"]'),
      );
      expect(rows[0].querySelector('[data-testid="sandbox-purpose"]')).toBeNull();
      expect(rows[0].querySelector('[data-testid="sandbox-accent"]')).not.toBeNull();
      expect(rows[1].querySelector('[data-testid="sandbox-purpose"]')).not.toBeNull();
      expect(rows[1].querySelector('[data-testid="sandbox-accent"]')).toBeNull();
    });

    it("still lists the sandboxes when the details cannot be read", async () => {
      agentAccessIpc.getOpenShellSandboxMeta.mockRejectedValue(new Error("boom"));
      const fixture = await render();
      expect(
        el(fixture).querySelectorAll('[data-testid="agent-access-openshell-row"]'),
      ).toHaveLength(2);
      agentAccessIpc.getOpenShellSandboxMeta.mockResolvedValue({ ok: false, error: "unsupported" });
      await click(fixture, "#agent-access-openshell-page_button_refresh");
      expect(
        el(fixture).querySelectorAll('[data-testid="agent-access-openshell-row"]'),
      ).toHaveLength(2);
    });

    it("cleans up a deleted sandbox's details, and only after the delete worked", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const fixture = await render();

      agentAccessIpc.openShellSandboxAction.mockResolvedValueOnce({ ok: false, error: "failed" });
      await act(fixture, "delete", ready);
      expect(agentAccessIpc.setOpenShellSandboxMeta).not.toHaveBeenCalled();

      await act(fixture, "stop", ready);
      expect(agentAccessIpc.setOpenShellSandboxMeta).not.toHaveBeenCalled();

      await act(fixture, "delete", ready);
      expect(agentAccessIpc.setOpenShellSandboxMeta).toHaveBeenCalledWith({
        name: "alpha",
        purpose: "",
        color: null,
      });
    });
  });
});
