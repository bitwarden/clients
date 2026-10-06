import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router, RouterLink } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  DialogService,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";
import { AgentAccessPageStateService } from "../services/agent-access-page-state.service";

import { AgentAccessAgentsComponent } from "./agent-access-agents.component";

// A lightweight stand-in for the real connected-agents component, matched by selector so
// `AgentAccessAgentsComponent`'s own template compiles and renders unchanged. Used only by the
// template-level tests below: the real `AgentAccessConnectedAgentsComponent` pulls in its own
// `DialogService`/`AgentAccessPageStateService` reads, which these tests aren't exercising —
// they're asserting on `AgentAccessAgentsComponent`'s own structure and its CTA link. (The child's
// own empty-state CTA is covered in `agent-access-connected-agents.component.spec.ts`.)
@Component({
  selector: "app-agent-access-connected-agents",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubAgentAccessConnectedAgentsComponent {}

// Stands in for `AgentAccessSetupComponent` at the "setup" route — the routing test only needs to
// prove the CTA link resolves and navigates there, not that the Setup tab itself renders correctly
// (that's `agent-access-setup.component.spec.ts`'s job).
@Component({
  selector: "app-setup-tab-stub",
  template: "setup-tab-stub",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SetupTabStubComponent {}

describe("AgentAccessAgentsComponent", () => {
  let originalIpc: any;
  let mockListGrants: jest.Mock;
  let pageState: AgentAccessPageStateService;
  // Stands in for the renderer-local GRANTS_CHANGED broadcast `DesktopAgentAccessService` sends
  // after every grant-store write.
  let grantsChangedSubject: Subject<Record<string, never>>;
  let messageListener: { messages$: jest.Mock };
  let dialogServiceMock: { openSimpleDialog: jest.Mock };

  function createComponent(): AgentAccessAgentsComponent {
    pageState = new AgentAccessPageStateService();
    TestBed.configureTestingModule({
      providers: [
        { provide: AgentAccessPageStateService, useValue: pageState },
        { provide: MessageListener, useValue: messageListener },
        { provide: DialogService, useValue: mock<DialogService>() },
      ],
    });
    return TestBed.runInInjectionContext(() => new AgentAccessAgentsComponent());
  }

  beforeEach(() => {
    dialogServiceMock = { openSimpleDialog: jest.fn().mockResolvedValue(true) };
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockListGrants = jest.fn().mockResolvedValue([]);
    grantsChangedSubject = new Subject();
    messageListener = {
      messages$: jest
        .fn()
        .mockImplementation((def: { command: string }) =>
          def.command === AGENT_ACCESS_IPC_CHANNELS.GRANTS_CHANGED
            ? grantsChangedSubject.asObservable()
            : new Subject().asObservable(),
        ),
    };

    originalIpc = (global as any).ipc;
    (global as any).ipc = {
      agentAccess: {
        // Both the constructor's effect and its GRANTS_CHANGED subscription call
        // `pageState.refreshGrants()`, so this must exist or an unflushed effect could reject.
        listGrants: mockListGrants,
      },
    };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
  });

  describe("grant store changes", () => {
    // The bug this covers: authorizing an agent through the first-use dialog only showed up in the
    // list after the page was reloaded/re-entered. Grants are per-route state fetched when the page
    // is entered, but the grant is written by `DesktopAgentAccessService` in response to an
    // incoming credential request — which can land while this tab is already open, long after that
    // fetch. The GRANTS_CHANGED broadcast is what closes that gap.
    it("re-reads the grant store when a grant is written, without the page being re-entered", async () => {
      createComponent();
      expect(pageState.grants()).toEqual([]);

      mockListGrants.mockResolvedValue([{ id: "grant-1", displayName: "Claude Code" }]);
      grantsChangedSubject.next({});
      await Promise.resolve();

      expect(pageState.grants()).toEqual([{ id: "grant-1", displayName: "Claude Code" }]);
    });

    it("subscribes to the same channel DesktopAgentAccessService broadcasts on", () => {
      createComponent();

      expect(messageListener.messages$).toHaveBeenCalledWith(
        expect.objectContaining({ command: AGENT_ACCESS_IPC_CHANNELS.GRANTS_CHANGED }),
      );
    });
  });

  describe("connect CTA (template)", () => {
    // The setup checklist (`app-onboarding` with a "running" and a "connect" task) that used to
    // render above the list is gone; a link to the Setup tab replaces it. Two things are worth
    // pinning down: that no stepper comes back, and that the CTA — shown here only once there's a
    // list to add to, since the child's empty state carries its own — resolves to the right route
    // rather than a relative path that only looks right in the template.
    async function renderAt(grants: unknown[]) {
      pageState = new AgentAccessPageStateService();
      pageState.statusLoading.set(false);
      pageState.grantsLoading.set(false);
      pageState.grants.set(grants as never);
      // The component's constructor effect refetches grants as soon as status loading settles, so
      // the ipc mock has to agree with the seeded signal or it would immediately overwrite it.
      mockListGrants.mockResolvedValue(grants);

      // The CTA's label goes through `I18nPipe`, so `I18nService.t` has to echo the key back rather
      // than return `undefined` for the link to render with content.
      const i18nServiceMock = mock<I18nService>();
      i18nServiceMock.t.mockImplementation((key: string, ...args: unknown[]) => {
        const defined = args.filter((arg) => arg != null);
        return defined.length > 0 ? `${key}(${defined.join(",")})` : key;
      });

      TestBed.configureTestingModule({
        providers: [
          provideRouter([
            {
              path: "agent-access",
              children: [
                { path: "agents", component: AgentAccessAgentsComponent },
                { path: "setup", component: SetupTabStubComponent },
              ],
            },
          ]),
          { provide: AgentAccessPageStateService, useValue: pageState },
          { provide: I18nService, useValue: i18nServiceMock },
          { provide: MessageListener, useValue: messageListener },
          { provide: DialogService, useValue: dialogServiceMock },
        ],
      });

      TestBed.overrideComponent(AgentAccessAgentsComponent, {
        set: {
          imports: [
            I18nPipe,
            RouterLink,
            StubAgentAccessConnectedAgentsComponent,
            AsyncActionsModule,
            ButtonModule,
            IconButtonModule,
            TableModule,
            CardComponent,
            SectionComponent,
            SectionHeaderComponent,
            SkeletonComponent,
            SkeletonGroupComponent,
            SkeletonTextComponent,
            TypographyModule,
          ],
        },
      });

      const harness = await RouterTestingHarness.create("/agent-access/agents");
      harness.detectChanges();
      return harness;
    }

    it("renders the connected-agents list with no onboarding stepper, whether or not any agent is connected", async () => {
      const harness = await renderAt([]);

      const compiled = harness.routeNativeElement as HTMLElement;
      expect(compiled.querySelector("app-onboarding")).toBeFalsy();
      expect(compiled.querySelector("app-onboarding-task")).toBeFalsy();
      expect(compiled.querySelector("app-agent-access-connected-agents")).toBeTruthy();
      // The connect UI itself lives exclusively on the Setup tab — this tab only ever links to it.
      expect(compiled.querySelector("app-agent-access-connect")).toBeFalsy();
    });

    it("lists OpenShell grants in their own section with sandbox, gateway, provider, digest and lifetime", async () => {
      const harness = await renderAt([
        {
          id: "os-1",
          signatureKind: "linuxPathOnly",
          signatureIdentity: "/usr/bin/openshell-gateway",
          displayName: "openshell-gateway",
          scope: "openshellSandbox",
          createdAt: 1,
          lastUsedAt: 1,
          openshell: {
            gatewayEndpoint: "https://127.0.0.1:17670",
            sandboxId: "sbx-01J9Z6",
            providerId: "prov-7f3a",
            gatewayName: "openshell",
            sandboxName: "agent-1",
            providerName: "gh-agent-1",
            policyDigest: "sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020",
            lifetimeMode: "ttl",
            windowExpiresAtMs: 1791234567890,
          },
        },
      ]);
      const root = harness.routeNativeElement as HTMLElement;
      const row = root.querySelector('[data-testid="agent-access-openshell-grant-row"]');
      expect(row?.textContent).toContain("agentAccessOpenShellGrantRow(agent-1,openshell)");
      expect(row?.textContent).toContain("gh-agent-1");
      expect(row?.textContent).toContain("998f40a71463");
      expect(row?.textContent).toContain("agentAccessOpenShellLifetimeTtl");
      expect(row?.querySelector("button[bitIconButton]")).toBeTruthy();
      // Not counted as a local agent: the header CTA stays hidden with no local grants.
      expect(root.querySelector("a[bitButton]")).toBeFalsy();
    });

    it("hides the header CTA while the list is empty, leaving the empty state's own CTA as the only one", async () => {
      const harness = await renderAt([]);

      expect((harness.routeNativeElement as HTMLElement).querySelector("a[bitButton]")).toBeFalsy();
    });

    it("resolves the header CTA's relative '../setup' link against the agents child route and navigates there on click", async () => {
      const harness = await renderAt([{ id: "grant-1", displayName: "Claude Code" }]);

      const link = (harness.routeNativeElement as HTMLElement).querySelector(
        "a[bitButton]",
      ) as HTMLAnchorElement;
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/agent-access/setup");

      link.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(TestBed.inject(Router).url).toBe("/agent-access/setup");
      expect(harness.routeNativeElement?.textContent).toContain("setup-tab-stub");
    });
  });

  describe("OpenShell grant rows (§M8.9)", () => {
    const localGrant = {
      id: "local-1",
      signatureKind: "macosTeamId",
      signatureIdentity: "TEAM:com.cursor",
      displayName: "Cursor",
      scope: "allLogins",
      createdAt: 1,
      lastUsedAt: 1,
    };
    const openShellGrant = {
      id: "os-1",
      signatureKind: "linuxPathOnly",
      signatureIdentity: "/usr/bin/openshell-gateway",
      displayName: "openshell-gateway",
      scope: "openshellSandbox",
      createdAt: 1,
      lastUsedAt: 1,
      openshell: {
        gatewayEndpoint: "https://127.0.0.1:17670",
        sandboxId: "sbx-01J9Z6",
        providerId: "prov-7f3a",
        gatewayName: "openshell",
        sandboxName: "agent-1",
        providerName: "gh-agent-1",
        policyDigest: "sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020",
        lifetimeMode: "ttl",
        windowExpiresAtMs: 1791234567890,
      },
    };

    it("separates OpenShell grants from local agents in the page state", () => {
      const state = new AgentAccessPageStateService();
      state.grants.set([localGrant, openShellGrant] as never);
      expect(state.localGrants().map((g) => g.id)).toEqual(["local-1"]);
      expect(state.openShellGrants().map((g) => g.id)).toEqual(["os-1"]);
    });
  });
});
