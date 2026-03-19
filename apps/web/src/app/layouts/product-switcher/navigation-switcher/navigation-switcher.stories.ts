import { Component, Directive, importProvidersFrom, Input } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, Observable, of } from "rxjs";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag, FeatureFlagValueType } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import {
  I18nMockService,
  LayoutComponent,
  NavigationModule,
  StorybookGlobalStateProvider,
} from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { positionFixedWrapperDecorator } from "@bitwarden/components/src/stories/storybook-decorators";
import { GlobalStateProvider } from "@bitwarden/state";
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

class MockConfigService implements Partial<ConfigService> {
  getFeatureFlag$<Flag extends FeatureFlag>(key: Flag): Observable<FeatureFlagValueType<Flag>> {
    return of(false as FeatureFlagValueType<Flag>);
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
  skipToContent: "Skip to content",
  toggleSideNavigation: "Toggle side navigation",
  resizeSideNavigation: "Resize side navigation",
  submenu: "submenu",
  toggleCollapse: "toggle collapse",
  close: "Close",
  loading: "Loading",
};

export default {
  title: "Web/Navigation Product Switcher",
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      declarations: [
        NavigationProductSwitcherComponent,
        MockOrganizationService,
        MockProviderService,
        StoryContentComponent,
      ],
      imports: [NavigationModule, RouterModule, LayoutComponent, I18nPipe],
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
        { provide: ConfigService, useClass: MockConfigService },
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
            <bit-nav-item text="Acme Corp — Vault" variant="tree"></bit-nav-item>
            <bit-nav-item text="Acme Corp — Members" variant="tree"></bit-nav-item>
            <bit-nav-item text="Acme Corp — Settings" variant="tree"></bit-nav-item>
            <bit-nav-item text="My Family" icon="bwi-collection-shared"></bit-nav-item>
            <bit-nav-item text="My Family — Vault" variant="tree"></bit-nav-item>
            <bit-nav-item text="My Family — Members" variant="tree"></bit-nav-item>
            <bit-nav-item text="Initech" icon="bwi-collection-shared"></bit-nav-item>
            <bit-nav-item text="Initech — Vault" variant="tree"></bit-nav-item>
            <bit-nav-item text="Initech — Members" variant="tree"></bit-nav-item>
            <bit-nav-item text="Initech — Settings" variant="tree"></bit-nav-item>
            <bit-nav-item text="Umbrella Corp" icon="bwi-collection-shared"></bit-nav-item>
            <bit-nav-item text="Umbrella Corp — Vault" variant="tree"></bit-nav-item>
            <bit-nav-item text="Umbrella Corp — Members" variant="tree"></bit-nav-item>
            <bit-nav-item text="Umbrella Corp — Settings" variant="tree"></bit-nav-item>
            <bit-nav-item text="Stark Industries" icon="bwi-collection-shared"></bit-nav-item>
            <bit-nav-item text="Stark Industries — Vault" variant="tree"></bit-nav-item>
            <bit-nav-item text="Stark Industries — Members" variant="tree"></bit-nav-item>
            <bit-nav-item text="Stark Industries — Settings" variant="tree"></bit-nav-item>
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
