import { Component, Directive, importProvidersFrom, Input } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, Observable, of } from "rxjs";

import { PasswordManagerLogo, SideNavLogo } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import {
  BadgeComponent,
  BerryComponent,
  CalloutComponent,
  I18nMockService,
  IconTileComponent,
  LayoutComponent,
  NavigationModule,
  StorybookGlobalStateProvider,
} from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { positionFixedWrapperDecorator } from "@bitwarden/components/src/stories/storybook-decorators";
import { GlobalStateProvider } from "@bitwarden/state";
import { enabledFlags } from "@bitwarden/storybook";
import { I18nPipe } from "@bitwarden/ui-common";

import { ProductSwitcherService } from "../shared/product-switcher.service";

import { NavigationProductSwitcherComponent } from "./navigation-switcher.component";

@Directive({
  selector: "[mockOrgs]",
  standalone: false,
})
// FIXME(https://bitwarden.atlassian.net/browse/PM-28232): Use Directive suffix
// eslint-disable-next-line @angular-eslint/directive-class-suffix
class MockOrganizationService implements Partial<OrganizationService> {
  private static _orgs = new BehaviorSubject<Organization[]>([]);

  organizations$(): Observable<Organization[]> {
    return MockOrganizationService._orgs.asObservable();
  }

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  set mockOrgs(orgs: Organization[]) {
    MockOrganizationService._orgs.next(orgs);
  }
}

@Directive({
  selector: "[mockProviders]",
  standalone: false,
})
// FIXME(https://bitwarden.atlassian.net/browse/PM-28232): Use Directive suffix
// eslint-disable-next-line @angular-eslint/directive-class-suffix
class MockProviderService implements Partial<ProviderService> {
  private static _providers = new BehaviorSubject<Provider[]>([]);

  providers$() {
    return MockProviderService._providers.asObservable();
  }

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  set mockProviders(providers: Provider[]) {
    MockProviderService._providers.next(providers);
  }
}

class MockSyncService implements Partial<SyncService> {
  async getLastSync() {
    return Promise.resolve(new Date());
  }
}

class MockAccountService implements Partial<AccountService> {
  // We can't use mockAccountInfoWith() here because we can't take a dependency on @bitwarden/common/spec.
  // This is because that package relies on jest dependencies that aren't available here.
  activeAccount$?: Observable<Account> = of({
    id: "test-user-id" as UserId,
    name: "Test User 1",
    email: "test@email.com",
    emailVerified: true,
    creationDate: new Date("2024-01-01T00:00:00.000Z"),
  });
}

class MockPlatformUtilsService implements Partial<PlatformUtilsService> {
  isSelfHost() {
    return false;
  }
}

class MockBillingAccountProfileStateService implements Partial<BillingAccountProfileStateService> {
  hasPremiumFromAnySource$(userId: UserId): Observable<boolean> {
    return of(false);
  }
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "story-content",
  template: ``,
  standalone: false,
})
class StoryContentComponent {}

const translations: Record<string, string> = {
  moreFromBitwarden: "More from Bitwarden",
  secureYourInfrastructure: "Secure your infrastructure",
  protectYourFamilyOrBusiness: "Protect your family or business",
  switchProducts: "Switch products",
  skipToContent: "Skip to content",
  toggleSideNavigation: "Toggle side navigation",
  resizeSideNavigation: "Resize side navigation",
  submenu: "submenu",
  toggleCollapse: "toggle collapse",
  close: "Close",
  loading: "Loading",
  sideNavigation: "Side navigation",
  skipLink: "Skip link",
};

export default {
  title: "Web/Navigation Product Switcher",
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      declarations: [MockOrganizationService, MockProviderService, StoryContentComponent],
      imports: [
        NavigationModule,
        RouterModule,
        LayoutComponent,
        I18nPipe,
        NavigationProductSwitcherComponent,
        BadgeComponent,
        BerryComponent,
        IconTileComponent,
        CalloutComponent,
      ],
      providers: [
        { provide: OrganizationService, useClass: MockOrganizationService },
        { provide: AccountService, useClass: MockAccountService },
        { provide: ProviderService, useClass: MockProviderService },
        { provide: SyncService, useClass: MockSyncService },
        { provide: PlatformUtilsService, useClass: MockPlatformUtilsService },
        {
          provide: BillingAccountProfileStateService,
          useClass: MockBillingAccountProfileStateService,
        },
        ProductSwitcherService,
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService(translations);
          },
        },
        {
          provide: PolicyService,
          useValue: {
            policyAppliesToUser$: () => of(false),
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        provideNoopAnimations(),
        importProvidersFrom(
          RouterModule.forRoot([{ path: "**", component: StoryContentComponent }], {
            useHash: true,
          }),
        ),
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
      ],
    }),
  ],
} as Meta<NavigationProductSwitcherComponent>;

type Story = StoryObj<
  NavigationProductSwitcherComponent & MockProviderService & MockOrganizationService
>;

const Template: Story = {
  render: (args) => ({
    props: { ...args, logo: PasswordManagerLogo },
    template: `
      <bit-layout>
        <bit-side-nav>
          <bit-nav-logo [openIcon]="logo" route="." label="Bitwarden"></bit-nav-logo>
          <bit-nav-item text="Vault" icon="bwi-lock"></bit-nav-item>
          <bit-nav-item text="Send" icon="bwi-send"></bit-nav-item>
          <bit-nav-group text="Tools" icon="bwi-key" [open]="true">
            <bit-nav-item text="Generator"></bit-nav-item>
            <bit-nav-item text="Import"></bit-nav-item>
            <bit-nav-item text="Export"></bit-nav-item>
          </bit-nav-group>
          <bit-nav-group text="Organizations" icon="bwi-business" [open]="true">
            <bit-nav-item text="Acme Corp" icon="bwi-collection-shared"></bit-nav-item>
            <bit-nav-item text="Acme Corp — Vault"></bit-nav-item>
            <bit-nav-item text="Acme Corp — Members"></bit-nav-item>
            <bit-nav-item text="Acme Corp — Settings"></bit-nav-item>
            <bit-nav-item text="My Family" icon="bwi-collection-shared"></bit-nav-item>
            <bit-nav-item text="My Family — Vault"></bit-nav-item>
            <bit-nav-item text="My Family — Members"></bit-nav-item>
            <bit-nav-item text="Initech" icon="bwi-collection-shared"></bit-nav-item>
            <bit-nav-item text="Initech — Vault"></bit-nav-item>
            <bit-nav-item text="Initech — Members"></bit-nav-item>
            <bit-nav-item text="Initech — Settings"></bit-nav-item>
            <bit-nav-item text="Umbrella Corp" icon="bwi-collection-shared"></bit-nav-item>
            <bit-nav-item text="Umbrella Corp — Vault"></bit-nav-item>
            <bit-nav-item text="Umbrella Corp — Members"></bit-nav-item>
            <bit-nav-item text="Umbrella Corp — Settings"></bit-nav-item>
            <bit-nav-item text="Stark Industries" icon="bwi-collection-shared"></bit-nav-item>
            <bit-nav-item text="Stark Industries — Vault"></bit-nav-item>
            <bit-nav-item text="Stark Industries — Members"></bit-nav-item>
            <bit-nav-item text="Stark Industries — Settings"></bit-nav-item>
          </bit-nav-group>
          <bit-nav-item text="Settings" icon="bwi-cog"></bit-nav-item>
          <ng-container slot="product-switcher">
            <bit-nav-divider></bit-nav-divider>
            <navigation-product-switcher [mockOrgs]="mockOrgs" [mockProviders]="mockProviders"></navigation-product-switcher>
          </ng-container>
        </bit-side-nav>
        <router-outlet></router-outlet>
      </bit-layout>
    `,
  }),
};

export const OnlyPM: Story = {
  ...Template,
  args: {
    mockOrgs: [],
    mockProviders: [],
  },
};

export const SMAvailable: Story = {
  ...Template,
  args: {
    mockOrgs: [
      {
        id: "org-a",
        canManageUsers: false,
        canAccessSecretsManager: true,
        enabled: true,
      },
    ] as Organization[],
    mockProviders: [],
  },
};

export const SMAndACAvailable: Story = {
  ...Template,
  args: {
    mockOrgs: [
      {
        id: "org-a",
        canManageUsers: true,
        canAccessSecretsManager: true,
        enabled: true,
      },
    ] as Organization[],
    mockProviders: [],
  },
};

export const WithAllOptions: Story = {
  ...Template,
  args: {
    mockOrgs: [
      {
        id: "org-a",
        canManageUsers: true,
        canAccessSecretsManager: true,
        enabled: true,
      },
    ] as Organization[],
    mockProviders: [{ id: "provider-a" }] as Provider[],
  },
};

/**
 * A realistic side nav: the product switcher plus a fuller set of items, including
 * nested nav groups. The v1/v2 layout is driven by the `VFO1Foundation` feature flag —
 * see the `RealisticSideNav` (v1) and `RealisticSideNavV2` (v2) stories.
 */
const RealisticTemplate: StoryObj<
  NavigationProductSwitcherComponent & MockProviderService & MockOrganizationService
> = {
  render: (args) => ({
    props: { ...args, logo: PasswordManagerLogo },
    template: `
      <bit-layout>
        <bit-side-nav>
          <bit-nav-logo [openIcon]="logo" route="." label="Bitwarden"></bit-nav-logo>
          <bit-nav-item text="Vault" icon="bwi-lock" route="vault"></bit-nav-item>
          <bit-nav-item text="Send" icon="bwi-send" route="send"></bit-nav-item>
          <bit-nav-group text="All items" route="all" [open]="true">
            
            <bit-nav-group text="Engineering" icon="bwi-collection-shared" route="eng">
              <bit-nav-item text="Frontend" route="eng-fe"></bit-nav-item>
              <bit-nav-item text="Backend" route="eng-be"></bit-nav-item>
            </bit-nav-group>
            <bit-nav-group text="Operations" icon="bwi-collection-shared" route="ops">
              <bit-nav-item text="Infrastructure" route="ops-infra"></bit-nav-item>
              <bit-nav-item text="Support" route="ops-support"></bit-nav-item>
            </bit-nav-group>
            <bit-berry slot="end" variant="primary" [value]="1"></bit-berry>
          </bit-nav-group>
          <bit-nav-group text="Tools" icon="bwi-key" route="tools" [open]="true">
            <bit-nav-item text="Generator" route="generator"></bit-nav-item>
            <bit-nav-item text="Import" route="import"></bit-nav-item>
            <bit-nav-item text="Export" route="export"></bit-nav-item>
          </bit-nav-group>
          <bit-nav-item text="Reports" icon="bwi-file-text" route="reports"></bit-nav-item>
          <bit-nav-item text="Settings" icon="bwi-cog" route="settings"></bit-nav-item>
          <ng-container slot="product-switcher">
            <bit-nav-divider></bit-nav-divider>
            <navigation-product-switcher [mockOrgs]="mockOrgs" [mockProviders]="mockProviders"></navigation-product-switcher>
          </ng-container>
        </bit-side-nav>
        <router-outlet></router-outlet>
      </bit-layout>
    `,
  }),
  args: {
    mockOrgs: [
      {
        id: "org-a",
        canManageUsers: true,
        canAccessSecretsManager: true,
        enabled: true,
      },
    ] as Organization[],
    mockProviders: [{ id: "provider-a" }] as Provider[],
  },
};

export const RealisticSideNav = {
  ...RealisticTemplate,
};

export const RealisticSideNavV2: Story = {
  render: (args) => ({
    props: { ...args, logo: SideNavLogo },
    template: `
      <bit-layout>
        <bit-side-nav>
          <bit-nav-logo [openIcon]="logo" route="." label="Bitwarden"></bit-nav-logo>
          <ng-container slot="product-switcher">
            <navigation-product-switcher [mockOrgs]="mockOrgs" [mockProviders]="mockProviders"></navigation-product-switcher>
          </ng-container>
          <bit-nav-group text="My vault" [open]="true">
            <bit-icon-tile icon="bwi-vault" variant="primary" size="sm"></bit-icon-tile>
            <bit-nav-item text="All vault items" route="all-items" icon="bwi-list"></bit-nav-item>
            <bit-nav-item text="My items" route="my-items" icon="bwi-user"></bit-nav-item>
            <bit-nav-item text="Shared folders" route="shared" icon="bwi-collection-shared"></bit-nav-item>
            <bit-nav-section icon="bwi-pin" label="Pinned">
              <bit-nav-group text="Engineering" icon="bwi-collection-shared" route="eng">
                <bit-nav-item text="Frontend" route="eng-fe"></bit-nav-item>
                <bit-nav-item text="Backend" route="eng-be"></bit-nav-item>
              </bit-nav-group>
              <bit-nav-group text="Operations" icon="bwi-collection-shared" route="ops">
                <bit-nav-item text="Infrastructure" route="ops-infra"></bit-nav-item>
                <bit-nav-item text="Support" route="ops-support"></bit-nav-item>
              </bit-nav-group>
            </bit-nav-section>
            <bit-berry slot="end" variant="primary" [value]="1"></bit-berry>
          </bit-nav-group>
          <bit-nav-section label="Tools">
            <bit-nav-item text="Send" icon="bwi-send" route="send"></bit-nav-item>
            <bit-nav-item text="Generator" route="generator"></bit-nav-item>
            <bit-nav-item text="Reports" icon="bwi-file-text" route="reports"></bit-nav-item>
          </bit-nav-section>
          <bit-nav-section label="Manage">
            <bit-nav-item text="My tags" icon="bwi-tag"></bit-nav-item>
            <bit-nav-item text="Archive" icon="bwi-archive">
              <bit-badge slot="end" startIcon="bwi-premium" size="small" variant="primary">Premium</bit-badge>
            </bit-nav-item>
            <bit-nav-item text="Settings" icon="bwi-cog" route="settings"></bit-nav-item>
          </bit-nav-section>
          <ng-container slot="callout">
            <div class="tw-px-3">
              <bit-callout class="[&_aside]:!tw-m-0" icon="bwi-premium" type="info" title="Info">Some promo callout content here</bit-callout>
            </div>
          </ng-container>
          <ng-container slot="account">
            <div class="tw-p-3">Account section would go here</div>
          </ng-container>
        </bit-side-nav>
        <router-outlet></router-outlet>
      </bit-layout>
    `,
  }),
  args: {
    mockOrgs: [
      {
        id: "org-a",
        canManageUsers: true,
        canAccessSecretsManager: true,
        enabled: true,
      },
    ] as Organization[],
    mockProviders: [{ id: "provider-a" }] as Provider[],
  },
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};
