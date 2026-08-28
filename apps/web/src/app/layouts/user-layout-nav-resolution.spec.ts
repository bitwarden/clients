import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter, Routes } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
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
import { PamUserNavSlotComponent } from "../pam/user-nav-slot/pam-user-nav-slot.component";
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
  selector: "app-pam-user-nav-slot",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPamUserNavSlotComponent {}

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

@Component({
  selector: "app-feature-page",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FeaturePageComponent {}

const userId = "user-id" as UserId;

const emptyViewModel: VaultsNavViewModel = { vaults: [], organizationDataOwnership: false };

/**
 * The production shape: ONE `UserLayoutComponent` mount at the root, with every feature — `/pam`
 * included — as a child of it. See `OssRoutingModule`.
 */
const routes: Routes = [
  {
    path: "",
    component: UserLayoutComponent,
    children: [
      { path: "vault", component: FeaturePageComponent },
      { path: "pam", children: [{ path: "", component: FeaturePageComponent }] },
    ],
  },
];

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

/**
 * The side nav's ~20 items use RELATIVE routes (`route="settings/account"`), and Angular resolves
 * a relative `routerLink` against the `ActivatedRoute` of the component rendering it. Mounting a
 * second `UserLayoutComponent` at a top-level path therefore silently re-bases the whole nav
 * beneath that path. This pins the property that keeps the links correct: however deep the user
 * navigates, the layout stays mounted at the root and its links stay root-relative.
 */
describe("UserLayoutComponent nav link resolution", () => {
  const flag$ = new BehaviorSubject<boolean>(true);
  const viewModel$ = new BehaviorSubject<VaultsNavViewModel>(emptyViewModel);
  const canArchive$ = new BehaviorSubject<boolean>(true);

  const configService = mock<ConfigService>();
  const vaultNavService = mock<VaultNavService>();
  const i18nService = mock<I18nService>();
  const policyService = mock<PolicyService>();
  const cipherArchiveService = mock<CipherArchiveService>();

  const setup = async () => {
    jest.clearAllMocks();
    flag$.next(true);
    viewModel$.next(emptyViewModel);
    canArchive$.next(true);

    i18nService.t.mockImplementation((key: string) => key);
    configService.getFeatureFlag$.mockReturnValue(flag$);
    policyService.policyAppliesToUser$.mockReturnValue(of(false));
    cipherArchiveService.userCanArchive$.mockReturnValue(canArchive$);
    Object.defineProperty(vaultNavService, "viewModel$", { value: viewModel$ });

    await TestBed.configureTestingModule({
      imports: [UserLayoutComponent, NavigationModule],
      providers: [
        provideRouter(routes),
        { provide: I18nService, useValue: i18nService },
        { provide: ConfigService, useValue: configService },
        { provide: VaultNavService, useValue: vaultNavService },
        { provide: PolicyService, useValue: policyService },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        { provide: SyncService, useValue: mock<SyncService>() },
        { provide: AccountService, useValue: { activeAccount$: of({ id: userId }) } },
        { provide: OrganizationService, useValue: { organizations$: () => of([]) } },
        { provide: SendPolicyService, useValue: { disableSend$: of(false) } },
        {
          provide: PremiumSubscriptionRoutingService,
          useValue: { getSubscriptionRoute$: () => of(null) },
        },
        { provide: CoachmarkService, useValue: mock<CoachmarkService>() },
        { provide: CipherArchiveService, useValue: cipherArchiveService },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
      ],
    })
      .overrideComponent(UserLayoutComponent, {
        remove: {
          imports: [
            WebLayoutModule,
            BillingFreeFamiliesNavItemComponent,
            CoachmarkComponent,
            PamUserNavSlotComponent,
          ],
        },
        add: {
          imports: [
            NavigationModule,
            MockWebLayoutComponent,
            MockWebSideNavComponent,
            MockBillingFreeFamiliesNavItemComponent,
            MockCoachmarkComponent,
            MockPamUserNavSlotComponent,
          ],
        },
      })
      .compileComponents();

    TestBed.inject(SideNavService).open.set(true);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl("/pam");
    harness.detectChanges();
    return harness;
  };

  /** Settings items live in a collapsed group; open it so their anchors render. */
  const expandSettings = (harness: RouterTestingHarness) => {
    const group = harness.fixture.debugElement
      .queryAll(By.css("bit-nav-group"))
      .find((el) => el.componentInstance.text() === "settings");
    group.componentInstance.open.set(true);
    harness.detectChanges();
  };

  it("keeps every nav link at the root while a child feature route is active", async () => {
    const harness = await setup();
    expandSettings(harness);

    const hrefs = Array.from(
      harness.fixture.nativeElement.querySelectorAll<HTMLAnchorElement>("a[href]"),
    ).map((anchor) => anchor.getAttribute("href"));

    expect(hrefs).toContain("/settings/account");
    expect(hrefs).toContain("/reports");
    expect(hrefs.filter((href) => href.startsWith("/pam/"))).toEqual([]);
  });
});
