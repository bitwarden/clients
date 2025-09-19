import { Component, Directive, importProvidersFrom, Input } from "@angular/core";
import { RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, Observable, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { LayoutComponent, NavigationModule } from "@bitwarden/components";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { I18nMockService } from "@bitwarden/components/src/utils/i18n-mock.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { ProductSwitcherService } from "../shared/product-switcher.service";

import { NavigationProductSwitcherComponent } from "./navigation-switcher.component";

@Directive({
  selector: "[mockOrgs]",
  standalone: false,
})
class MockOrganizationService implements Partial<OrganizationService> {
  private static _orgs = new BehaviorSubject<Organization[]>([]);

  organizations$(): Observable<Organization[]> {
    return MockOrganizationService._orgs.asObservable();
  }

  @Input()
  set mockOrgs(orgs: Organization[]) {
    MockOrganizationService._orgs.next(orgs);
  }
}

@Directive({
  selector: "[mockProviders]",
  standalone: false,
})
class MockProviderService implements Partial<ProviderService> {
  private static _providers = new BehaviorSubject<Provider[]>([]);

  providers$() {
    return MockProviderService._providers.asObservable();
  }

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
  activeAccount$?: Observable<Account> = of({
    id: "test-user-id" as UserId,
    name: "Test User 1",
    email: "test@email.com",
    emailVerified: true,
  });
}

class MockPlatformUtilsService implements Partial<PlatformUtilsService> {
  isSelfHost() {
    return false;
  }
}

@Component({
  selector: "story-layout",
  template: `<ng-content></ng-content>`,
  standalone: false,
})
class StoryLayoutComponent {}

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
};

export default {
  title: "Web/Navigation Product Switcher",
  decorators: [
    moduleMetadata({
      declarations: [
        NavigationProductSwitcherComponent,
        MockOrganizationService,
        MockProviderService,
        StoryLayoutComponent,
        StoryContentComponent,
      ],
      imports: [NavigationModule, RouterModule, LayoutComponent, I18nPipe],
      providers: [
        { provide: OrganizationService, useClass: MockOrganizationService },
        { provide: AccountService, useClass: MockAccountService },
        { provide: ProviderService, useClass: MockProviderService },
        { provide: SyncService, useClass: MockSyncService },
        { provide: PlatformUtilsService, useClass: MockPlatformUtilsService },
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
        importProvidersFrom(
          RouterModule.forRoot([
            {
              path: "",
              component: StoryLayoutComponent,
              children: [
                {
                  path: "**",
                  component: StoryContentComponent,
                },
              ],
            },
          ]),
        ),
      ],
    }),
  ],
} as Meta<NavigationProductSwitcherComponent>;

type Story = StoryObj<
  NavigationProductSwitcherComponent & MockProviderService & MockOrganizationService
>;

const Template: Story = {
  render: (args) => ({
    props: args,
    template: `
    <router-outlet [mockOrgs]="mockOrgs" [mockProviders]="mockProviders"></router-outlet>
    <div class="tw-bg-background-alt3 tw-w-60">
      <navigation-product-switcher></navigation-product-switcher>
    </div>
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
