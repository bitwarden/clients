import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { NavigationModule, SideNavService } from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";
import { GlobalStateProvider } from "@bitwarden/state";
import { VaultNavService, VaultsNavViewModel } from "@bitwarden/vault";

import { PremiumSubscriptionRoutingService } from "../billing/individual/services/premium-subscription-routing.service";
import { BillingFreeFamiliesNavItemComponent } from "../billing/shared/billing-free-families-nav-item.component";
import { CoachmarkComponent, CoachmarkService } from "../vault/components/coachmark";

import { UserLayoutComponent } from "./user-layout.component";
import { WebLayoutModule } from "./web-layout.module";

@Component({
  selector: "app-layout",
  template: "<ng-content></ng-content>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockWebLayoutComponent {}

@Component({
  selector: "app-side-nav",
  template: "<ng-content></ng-content>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockWebSideNavComponent {}

@Component({
  selector: "billing-free-families-nav-item",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockBillingFreeFamiliesNavItemComponent {}

@Component({
  selector: "app-coachmark",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockCoachmarkComponent {
  popover(): undefined {
    return undefined;
  }
}

const userId = "user-id" as UserId;

const emptyViewModel: VaultsNavViewModel = {
  vaults: [],
  organizationDataOwnership: false,
};

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe("UserLayoutComponent", () => {
  let fixture: ComponentFixture<UserLayoutComponent>;

  const flag$ = new BehaviorSubject<boolean>(false);
  const viewModel$ = new BehaviorSubject<VaultsNavViewModel>(emptyViewModel);

  const canArchive$ = new BehaviorSubject<boolean>(true);
  const archivedCiphers$ = new BehaviorSubject<unknown[]>([]);

  const configService = mock<ConfigService>();
  const vaultNavService = mock<VaultNavService>();
  const i18nService = mock<I18nService>();
  const policyService = mock<PolicyService>();
  const cipherArchiveService = mock<CipherArchiveService>();
  const premiumUpgradePromptService = mock<PremiumUpgradePromptService>();

  /** Trimmed text of every rendered nav item and group, in document order. */
  const navText = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll("bit-nav-item, bit-nav-group, bit-nav-section"),
    ).map((el) => {
      const element = el as HTMLElement;
      // Sections render their heading as a sibling of the projected items, so read the heading directly.
      if (element.tagName.toLowerCase() === "bit-nav-section") {
        return element.querySelector("[id^='bit-nav-section-']")?.textContent?.trim();
      }
      return element.textContent?.trim().split("\n")[0].trim();
    });

  /** Groups collapse by default, so their children need expanding before they render. */
  const expandGroup = (label: string) => {
    const group = fixture.debugElement
      .queryAll(By.css("bit-nav-group"))
      .find((el) => el.componentInstance.text() === label);
    group.componentInstance.open.set(true);
    fixture.detectChanges();
    return group.nativeElement as HTMLElement;
  };

  const childText = (group: HTMLElement) =>
    Array.from(group.querySelectorAll("bit-nav-item")).map((el) =>
      (el as HTMLElement).textContent?.trim().split("\n")[0].trim(),
    );

  beforeEach(async () => {
    flag$.next(false);
    viewModel$.next(emptyViewModel);

    jest.clearAllMocks();

    canArchive$.next(true);
    archivedCiphers$.next([]);

    i18nService.t.mockImplementation((key: string) => key);
    configService.getFeatureFlag$.mockReturnValue(flag$);
    policyService.policyAppliesToUser$.mockReturnValue(of(false));
    cipherArchiveService.userCanArchive$.mockReturnValue(canArchive$);
    cipherArchiveService.archivedCiphers$.mockReturnValue(archivedCiphers$ as any);
    vaultNavService.viewModel$.mockReturnValue(viewModel$);

    await TestBed.configureTestingModule({
      imports: [UserLayoutComponent, RouterModule.forRoot([]), NavigationModule],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: ConfigService, useValue: configService },
        { provide: VaultNavService, useValue: vaultNavService },
        { provide: PolicyService, useValue: policyService },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        { provide: SyncService, useValue: mock<SyncService>() },
        { provide: AccountService, useValue: { activeAccount$: of({ id: userId }) } },
        { provide: SendPolicyService, useValue: { disableSend$: of(false) } },
        {
          provide: PremiumSubscriptionRoutingService,
          useValue: { getSubscriptionRoute$: () => of(null) },
        },
        { provide: CoachmarkService, useValue: mock<CoachmarkService>() },
        { provide: CipherArchiveService, useValue: cipherArchiveService },
        { provide: PremiumUpgradePromptService, useValue: premiumUpgradePromptService },
      ],
    })
      .overrideComponent(UserLayoutComponent, {
        remove: {
          imports: [WebLayoutModule, BillingFreeFamiliesNavItemComponent, CoachmarkComponent],
        },
        add: {
          imports: [
            NavigationModule,
            MockWebLayoutComponent,
            MockWebSideNavComponent,
            MockBillingFreeFamiliesNavItemComponent,
            MockCoachmarkComponent,
          ],
        },
      })
      .compileComponents();

    // Nav items only render their text when the side nav is expanded.
    TestBed.inject(SideNavService).open.set(true);

    fixture = TestBed.createComponent(UserLayoutComponent);
    fixture.detectChanges();
  });

  describe("flag off", () => {
    it("renders the current navigation unchanged", () => {
      const text = navText();

      expect(text).toContain("vaults");
      expect(text).not.toContain("manage");
      expect(text).not.toContain("allItems");
      expect(childText(expandGroup("tools"))).toEqual(
        expect.arrayContaining(["generator", "importNoun", "exportNoun"]),
      );
    });
  });

  describe("flag on", () => {
    beforeEach(() => {
      flag$.next(true);
      fixture.detectChanges();
    });

    it("renders Tools with Reports, Send and Generator, and no Import", () => {
      const text = navText();

      expect(text).toEqual(expect.arrayContaining(["tools", "reports", "send", "generator"]));
      expect(text).not.toContain("importNoun");
    });

    it("renders Manage with My folders, Archive, Trash and Settings", () => {
      const text = navText();

      expect(text).toEqual(
        expect.arrayContaining(["manage", "myFolders", "archiveNoun", "trash", "settings"]),
      );
    });

    it("renders Export as the last Settings child", () => {
      const children = childText(expandGroup("settings"));

      expect(children[children.length - 1]).toBe("exportNoun");
    });

    it("renders Add plan after Emergency access and before Export", () => {
      const children = childText(expandGroup("settings"));

      expect(children).toContain("addPlan");
      expect(children.indexOf("emergencyAccess")).toBeLessThan(children.indexOf("addPlan"));
      expect(children.indexOf("addPlan")).toBeLessThan(children.indexOf("exportNoun"));
    });
  });
});
