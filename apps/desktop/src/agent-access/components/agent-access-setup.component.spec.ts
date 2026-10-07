import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, forwardRef, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  NoItemsModule,
  SectionComponent,
  SectionHeaderComponent,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TableModule,
  ToggleGroupModule,
  TypographyModule,
} from "@bitwarden/components";
import type { agent_access } from "@bitwarden/desktop-napi";
import { I18nPipe } from "@bitwarden/ui-common";

import { AgentAccessPageStateService } from "../services/agent-access-page-state.service";

import { AgentAccessOpenShellSectionComponent } from "./agent-access-openshell-section.component";
import { AgentAccessPairAgentDialogComponent } from "./agent-access-pair-agent-dialog.component";
import { AgentAccessSetupComponent } from "./agent-access-setup.component";

// A lightweight stand-in for the real connect component, matched by selector so
// `AgentAccessSetupComponent`'s own template compiles and renders unchanged. Used only by the
// template-rendering tests below, which assert on where the connect UI lands in this tab's own
// structure (as the first of two peer sections, never gated on this tab's own fetch) — not on the
// connect grid's own internals, which pull in their own IPC calls
// (`agent-access-connect.component.spec.ts` covers those).
@Component({
  selector: "app-agent-access-connect",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubAgentAccessConnectComponent {}

// Stands in for the section's own "does this apply" answer, which the tab reads for its toggle.
const openShellVisible = signal(false);

// Same treatment for the OpenShell section (agent-access-openshell-section.component.spec.ts
// covers it): these tests are about this tab's own structure. One test below asserts the section
// is placed on the tab.
@Component({
  selector: "app-agent-access-openshell-section",
  template: "",
  // The tab finds the section with `viewChild(AgentAccessOpenShellSectionComponent)`; a query
  // matches provider tokens, so the stub answers to the real class.
  providers: [
    {
      provide: AgentAccessOpenShellSectionComponent,
      useExisting: forwardRef(() => StubAgentAccessOpenShellSectionComponent),
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubAgentAccessOpenShellSectionComponent {
  readonly visible = openShellVisible;
}

describe("AgentAccessSetupComponent", () => {
  let originalIpc: any;
  let mockListConnections: jest.Mock;
  let mockRemoveConnection: jest.Mock;
  let dialogService: { openSimpleDialog: jest.Mock };
  let pageState: AgentAccessPageStateService;

  const connection: agent_access.ConnectionInfoData = {
    fingerprint: "abcd1234",
    name: "My CI box",
    lastConnectedAt: undefined,
  } as agent_access.ConnectionInfoData;

  function createComponent(): AgentAccessSetupComponent {
    pageState = new AgentAccessPageStateService();
    TestBed.configureTestingModule({
      providers: [
        { provide: AgentAccessPageStateService, useValue: pageState },
        { provide: DialogService, useValue: dialogService },
      ],
    });
    return TestBed.runInInjectionContext(() => new AgentAccessSetupComponent());
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockListConnections = jest.fn().mockResolvedValue([connection]);
    mockRemoveConnection = jest.fn().mockResolvedValue(undefined);
    dialogService = { openSimpleDialog: jest.fn().mockResolvedValue(true) };

    originalIpc = (global as any).ipc;
    (global as any).ipc = {
      agentAccess: {
        listConnections: mockListConnections,
        removeConnection: mockRemoveConnection,
        // Not exercised directly by any test here — `AgentAccessConnectComponent` is stubbed out
        // in the "template" describe block below (see `agent-access-connect.component.spec.ts` for
        // its own coverage) — but kept on the shared mock ipc object for consistency with the rest
        // of this file, in case a future test renders the real component.
        getBundledCliPath: jest.fn().mockResolvedValue("/Applications/Bitwarden.app/aac"),
        detectAgents: jest.fn().mockResolvedValue([]),
        getAgentRegistrationStatuses: jest.fn().mockResolvedValue([]),
      },
    };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
  });

  describe("refreshConnections", () => {
    it("lists connections when the agent is running", async () => {
      const component = createComponent();
      pageState.running.set(true);

      await (component as any).refreshConnections();

      expect(mockListConnections).toHaveBeenCalled();
      expect((component as any).connections()).toEqual([connection]);
    });

    it("doesn't list connections — and clears the list — when the agent isn't running", async () => {
      const component = createComponent();
      pageState.running.set(false);

      await (component as any).refreshConnections();

      expect(mockListConnections).not.toHaveBeenCalled();
      expect((component as any).connections()).toEqual([]);
    });
  });

  describe("removeConnectionAction", () => {
    it("removes the connection and refreshes when confirmed", async () => {
      const component = createComponent();

      await (component as any).removeConnectionAction(connection)();

      expect(mockRemoveConnection).toHaveBeenCalledWith("abcd1234");
    });

    it("does nothing when declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const component = createComponent();

      await (component as any).removeConnectionAction(connection)();

      expect(mockRemoveConnection).not.toHaveBeenCalled();
    });
  });

  describe("openPairAgentDialog", () => {
    it("opens the remote-only pair dialog and refreshes connections once it closes", async () => {
      const component = createComponent();
      pageState.running.set(true);
      const openSpy = jest
        .spyOn(AgentAccessPairAgentDialogComponent, "open")
        .mockReturnValue({ closed: of(undefined) } as any);

      await (component as any).openPairAgentDialog();

      expect(openSpy).toHaveBeenCalledWith(dialogService);
      expect(mockListConnections).toHaveBeenCalled();

      openSpy.mockRestore();
    });
  });

  describe("loading", () => {
    it("covers the remote-agents section only — it stays true until both the shared status and this tab's own connection fetch settle", async () => {
      const component = createComponent();
      pageState.running.set(true);

      // `connectionsLoading` starts true, so the section is loading regardless of status.
      pageState.statusLoading.set(false);
      expect((component as any).loading()).toBe(true);

      await (component as any).refreshConnections();
      expect((component as any).loading()).toBe(false);

      // A later status refresh puts the section back into its loading state.
      pageState.statusLoading.set(true);
      expect((component as any).loading()).toBe(true);
    });
  });

  describe("template", () => {
    let fixture: ComponentFixture<AgentAccessSetupComponent>;

    beforeEach(() => {
      pageState = new AgentAccessPageStateService();

      TestBed.configureTestingModule({
        imports: [AgentAccessSetupComponent],
        providers: [
          { provide: AgentAccessPageStateService, useValue: pageState },
          { provide: DialogService, useValue: dialogService },
          { provide: I18nService, useValue: mock<I18nService>() },
        ],
      });

      TestBed.overrideComponent(AgentAccessSetupComponent, {
        set: {
          imports: [
            DatePipe,
            I18nPipe,
            StubAgentAccessConnectComponent,
            StubAgentAccessOpenShellSectionComponent,
            AsyncActionsModule,
            ButtonModule,
            IconButtonModule,
            NoItemsModule,
            SectionComponent,
            SectionHeaderComponent,
            SkeletonComponent,
            SkeletonGroupComponent,
            SkeletonTextComponent,
            TableModule,
            ToggleGroupModule,
            TypographyModule,
          ],
        },
      });

      fixture = TestBed.createComponent(AgentAccessSetupComponent);
    });

    it("places the OpenShell section on the tab (it renders nothing on its own unless detected)", async () => {
      pageState.statusLoading.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector("app-agent-access-openshell-section"),
      ).not.toBeNull();
    });

    it("renders both ways of adding an agent as peer sections, neither behind a disclosure", async () => {
      pageState.statusLoading.set(false);
      pageState.running.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;

      const connectEl = compiled.querySelector("app-agent-access-connect");
      expect(connectEl).toBeTruthy();
      expect(connectEl?.closest("bit-disclosure")).toBeNull();

      // The remote path is a visible section, not a collapsed disclosure the user has to open
      // before they can tell this page pairs remote agents at all.
      const remoteSection = compiled.querySelector("bit-section");
      expect(remoteSection).toBeTruthy();
      expect(compiled.querySelector("bit-disclosure")).toBeNull();
    });

    it("shows one pane at a time, starting on the local agents", async () => {
      pageState.statusLoading.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const paneHidden = (selector: string) =>
        (fixture.nativeElement.querySelector(selector).parentElement as HTMLElement).hidden;
      expect(paneHidden("app-agent-access-connect")).toBe(false);
      expect(paneHidden("app-agent-access-openshell-section")).toBe(true);

      (fixture.componentInstance as any).selectedPane.set("remote");
      fixture.detectChanges();
      expect(paneHidden("app-agent-access-connect")).toBe(true);
    });

    it("offers the OpenShell pane only when the section applies, and falls back if it stops", async () => {
      pageState.statusLoading.set(false);
      fixture.detectChanges();
      await fixture.whenStable();
      const component = fixture.componentInstance as any;

      openShellVisible.set(false);
      component.selectedPane.set("openShell");
      fixture.detectChanges();
      expect(component.activePane()).toBe("local");

      openShellVisible.set(true);
      fixture.detectChanges();
      expect(component.activePane()).toBe("openShell");

      openShellVisible.set(false);
      fixture.detectChanges();
      expect(component.activePane()).toBe("local");
    });

    it("does not gate the local connect UI on this tab's own remote-connection fetch", () => {
      // `connectionsLoading` starts true and `statusLoading` is still true — the state that used
      // to blank the whole tab behind one skeleton.
      pageState.statusLoading.set(true);
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector("app-agent-access-connect")).toBeTruthy();
      // The remote section alone shows its skeleton.
      expect(compiled.querySelector("bit-skeleton-group")).toBeTruthy();
      expect(compiled.querySelector("bit-table")).toBeFalsy();
    });

    it("offers pairing from the remote section's empty state when nothing is paired", async () => {
      mockListConnections.mockResolvedValue([]);
      pageState.statusLoading.set(false);
      pageState.running.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector("[data-testid='agent-access-no-paired-agents']")).toBeTruthy();
      expect(compiled.querySelector("#agent-access-setup_button_pair-agent-empty")).toBeTruthy();
      // The header action is suppressed while the empty state carries the same call to action.
      expect(compiled.querySelector("#agent-access-setup_button_pair-agent")).toBeFalsy();
    });

    it("lists paired agents in a table with the pair action beside the description", async () => {
      pageState.statusLoading.set(false);
      pageState.running.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      expect(compiled.querySelector("bit-table")).toBeTruthy();
      expect(compiled.querySelector("#agent-access-setup_button_pair-agent")).toBeTruthy();
      expect(compiled.querySelector("[data-testid='agent-access-no-paired-agents']")).toBeFalsy();
      expect(
        compiled.querySelector(`#agent-access-setup_button_remove-agent-${connection.fingerprint}`),
      ).toBeTruthy();
    });
  });
});
