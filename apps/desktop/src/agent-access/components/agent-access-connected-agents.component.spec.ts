import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";

import { AGENT_LOGOS } from "../icons";
import { AgentAccessGrant } from "../models/agent-access-grant";
import { AgentId } from "../models/agent-id";
import { AgentAccessPageStateService } from "../services/agent-access-page-state.service";

import { AgentAccessConnectedAgentsComponent } from "./agent-access-connected-agents.component";

// Stands in for `AgentAccessSetupComponent` at the "setup" route — the empty-state CTA test only
// needs to prove the link resolves and navigates there.
@Component({
  selector: "app-setup-tab-stub",
  template: "setup-tab-stub",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SetupTabStubComponent {}

describe("AgentAccessConnectedAgentsComponent", () => {
  const dialogService = mock<DialogService>();

  let originalIpc: any;
  let mockListGrants: jest.Mock;
  let mockRemoveGrant: jest.Mock;
  let pageState: AgentAccessPageStateService;

  const signedGrant: AgentAccessGrant = {
    id: "grant-1",
    signatureKind: "macosTeamId",
    signatureIdentity: "TEAMID123:com.anysphere.cursor",
    displayName: "Cursor",
    exePath: "/Applications/Cursor.app",
    scope: "allLogins",
    createdAt: 1700000000,
    lastUsedAt: 1700000100,
  };

  const publisherGrant: AgentAccessGrant = {
    id: "grant-2",
    signatureKind: "windowsPublisher",
    signatureIdentity: "CN=Anysphere, Inc.",
    displayName: "Cursor",
    scope: "allLogins",
    createdAt: 1700000000,
    lastUsedAt: 1700000100,
  };

  const unsignedGrant: AgentAccessGrant = {
    id: "grant-3",
    signatureKind: "path",
    signatureIdentity: "/usr/local/bin/some-agent",
    displayName: "Unknown agent",
    exePath: "/usr/local/bin/some-agent",
    scope: "allLogins",
    createdAt: 1700000000,
    lastUsedAt: 1700000100,
  };

  const claudeSignedGrant: AgentAccessGrant = {
    id: "grant-4",
    signatureKind: "macosTeamId",
    signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
    displayName: "Claude Code",
    exePath: "/Applications/Claude Code.app",
    scope: "allLogins",
    createdAt: 1700000000,
    lastUsedAt: 1700000100,
  };

  function createComponent(): AgentAccessConnectedAgentsComponent {
    pageState = new AgentAccessPageStateService();
    TestBed.configureTestingModule({
      providers: [
        { provide: DialogService, useValue: dialogService },
        { provide: AgentAccessPageStateService, useValue: pageState },
      ],
    });
    return TestBed.runInInjectionContext(() => new AgentAccessConnectedAgentsComponent());
  }

  beforeEach(() => {
    jest.clearAllMocks();

    mockListGrants = jest.fn().mockResolvedValue([signedGrant]);
    mockRemoveGrant = jest.fn().mockResolvedValue(undefined);

    originalIpc = (global as any).ipc;
    (global as any).ipc = {
      agentAccess: {
        listGrants: mockListGrants,
        removeGrant: mockRemoveGrant,
      },
    };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
  });

  describe("rendering grants", () => {
    it("reads grants and loading state from the shared page state, not its own fetch", () => {
      createComponent();
      pageState.grants.set([signedGrant]);
      pageState.grantsLoading.set(false);

      // Same instance the component was constructed with (see `createComponent`) — no local
      // `listGrants()` call happens on this component anymore.
      expect(pageState.grants()).toEqual([signedGrant]);
      expect(pageState.grantsLoading()).toBe(false);
      expect(mockListGrants).not.toHaveBeenCalled();
    });
  });

  describe("descriptorKind", () => {
    it("is signedBy for a macOS team ID signature", () => {
      const component = createComponent();

      expect((component as any).descriptorKind(signedGrant)).toBe("signedBy");
    });

    it("is publishedBy for a Windows publisher signature", () => {
      const component = createComponent();

      expect((component as any).descriptorKind(publisherGrant)).toBe("publishedBy");
    });

    it("falls back to path for an unsigned/path-keyed grant", () => {
      const component = createComponent();

      expect((component as any).descriptorKind(unsignedGrant)).toBe("path");
    });
  });

  describe("descriptorValue", () => {
    it("prefers signatureIdentity over exePath", () => {
      const component = createComponent();

      expect((component as any).descriptorValue(signedGrant)).toBe(
        "TEAMID123:com.anysphere.cursor",
      );
    });

    it("falls back to exePath when signatureIdentity is empty", () => {
      const component = createComponent();
      const grant = { ...unsignedGrant, signatureIdentity: "" };

      expect((component as any).descriptorValue(grant)).toBe("/usr/local/bin/some-agent");
    });
  });

  describe("brandLogo", () => {
    it("resolves the Claude logo for a macOS-signed Claude grant", () => {
      const component = createComponent();

      expect((component as any).brandLogo(claudeSignedGrant)).toBe(AGENT_LOGOS[AgentId.Claude]);
    });

    // Security-relevant case: a `path`-kind grant means the signature was missing, invalid, or
    // unresolved (see `deriveAgentAccessAttestationKey`), so it must NEVER resolve a brand logo —
    // doing so would let an unsigned/unverified binary borrow a trusted vendor's mark. This grant's
    // `signatureIdentity` is itself a real Claude identity string, to prove the neutral fallback
    // holds on identity content alone and doesn't leak through when the kind is wrong.
    it("renders the neutral fallback, never a logo, for a path-kind grant even with a Claude-shaped identity", () => {
      const component = createComponent();
      const grant: AgentAccessGrant = {
        ...unsignedGrant,
        signatureKind: "path",
        signatureIdentity: "Q6L2SF6YDW:com.anthropic.claude-code",
      };

      expect((component as any).brandLogo(grant)).toBeUndefined();
      expect((component as any).brandLogo(grant)).not.toBe(AGENT_LOGOS[AgentId.Claude]);
    });

    it("renders the neutral fallback for an unsigned grant", () => {
      const component = createComponent();

      expect((component as any).brandLogo(unsignedGrant)).toBeUndefined();
    });
  });

  describe("removeGrantAction", () => {
    it("removes the grant and refreshes the shared page state when confirmed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const component = createComponent();
      pageState.grants.set([signedGrant]);
      mockListGrants.mockResolvedValue([]);

      await (component as any).removeGrantAction(signedGrant)();

      expect(mockRemoveGrant).toHaveBeenCalledWith("grant-1");
      expect(mockListGrants).toHaveBeenCalled();
      expect(pageState.grants()).toEqual([]);
    });

    it("does nothing when the confirmation is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const component = createComponent();

      await (component as any).removeGrantAction(signedGrant)();

      expect(mockRemoveGrant).not.toHaveBeenCalled();
    });
  });

  describe("row template", () => {
    let fixture: ComponentFixture<AgentAccessConnectedAgentsComponent>;

    beforeEach(() => {
      pageState = new AgentAccessPageStateService();

      // The row descriptor text is driven by `I18nPipe`, which needs `I18nService.t` to actually
      // interpolate the key and value rather than return `undefined` — echo both back so the
      // assertions below can check for them.
      const i18nServiceMock = mock<I18nService>();
      i18nServiceMock.t.mockImplementation((key: string, p1?: string | number) =>
        p1 != null ? `${key}:${p1}` : key,
      );

      TestBed.configureTestingModule({
        imports: [AgentAccessConnectedAgentsComponent],
        providers: [
          { provide: DialogService, useValue: dialogService },
          { provide: AgentAccessPageStateService, useValue: pageState },
          { provide: I18nService, useValue: i18nServiceMock },
        ],
      });

      fixture = TestBed.createComponent(AgentAccessConnectedAgentsComponent);
    });

    it("renders the agent name and its signature descriptor, and swaps the icon tile between a brand logo and the neutral fallback", () => {
      pageState.grantsLoading.set(false);
      pageState.grants.set([claudeSignedGrant, unsignedGrant]);
      fixture.detectChanges();

      const compiled: HTMLElement = fixture.nativeElement;
      const rows = compiled.querySelectorAll("tbody tr");
      expect(rows.length).toBe(2);

      // Row 1: a real verified Claude signature — name + "signed by" descriptor, brand logo tile.
      expect(rows[0].textContent).toContain(claudeSignedGrant.displayName);
      expect(rows[0].textContent).toContain(
        `agentAccessFirstUseSignedBy:${claudeSignedGrant.signatureIdentity}`,
      );
      expect(rows[0].querySelector("bit-svg")).toBeTruthy();
      expect(rows[0].querySelector("bit-icon")).toBeFalsy();

      // Row 2: `path`-kind (unsigned) — name + "at path" descriptor, neutral fallback glyph, no logo.
      expect(rows[1].textContent).toContain(unsignedGrant.displayName);
      expect(rows[1].textContent).toContain(
        `agentAccessFirstUseAtPath:${unsignedGrant.signatureIdentity}`,
      );
      expect(rows[1].querySelector("bit-svg")).toBeFalsy();
      expect(rows[1].querySelector("bit-icon")).toBeTruthy();
    });
  });

  describe("empty state CTA", () => {
    // This CTA replaces the setup checklist that used to sit above this list on the Agents tab, so
    // for a user with nothing connected it's the only pointer to where agents actually get added.
    // Rendered as a routed child of `agent-access` — the shape it always has in the real app, since
    // it's nested inside `AgentAccessAgentsComponent`'s `agents` route — because that's what makes
    // its relative `../setup` link resolve the way it does at runtime.
    it("links to the Setup tab and navigates there on click", async () => {
      pageState = new AgentAccessPageStateService();
      pageState.grantsLoading.set(false);
      pageState.grants.set([]);

      // The CTA's label goes through `I18nPipe`, so `I18nService.t` has to echo the key back rather
      // than return `undefined` for the link to render with content.
      const i18nServiceMock = mock<I18nService>();
      i18nServiceMock.t.mockImplementation((key: string) => key);

      TestBed.configureTestingModule({
        providers: [
          provideRouter([
            {
              path: "agent-access",
              children: [
                { path: "agents", component: AgentAccessConnectedAgentsComponent },
                { path: "setup", component: SetupTabStubComponent },
              ],
            },
          ]),
          { provide: DialogService, useValue: dialogService },
          { provide: AgentAccessPageStateService, useValue: pageState },
          { provide: I18nService, useValue: i18nServiceMock },
        ],
      });

      const harness = await RouterTestingHarness.create("/agent-access/agents");
      harness.detectChanges();

      const compiled = harness.routeNativeElement as HTMLElement;
      expect(
        compiled.querySelector("[data-testid='agent-access-no-connected-agents']"),
      ).toBeTruthy();

      const link = compiled.querySelector("a[bitButton]") as HTMLAnchorElement;
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/agent-access/setup");

      link.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(TestBed.inject(Router).url).toBe("/agent-access/setup");
      expect(harness.routeNativeElement?.textContent).toContain("setup-tab-stub");
    });
  });
});
