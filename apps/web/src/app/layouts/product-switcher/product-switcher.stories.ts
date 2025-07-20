import { Component, Directive, importProvidersFrom, Input } from "@angular/core";
import { RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, firstValueFrom, Observable, of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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
import { IconButtonModule, LinkModule, MenuModule } from "@bitwarden/components";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { I18nMockService } from "@bitwarden/components/src/utils/i18n-mock.service";

import { ProductSwitcherContentComponent } from "./product-switcher-content.component";
import { ProductSwitcherComponent } from "./product-switcher.component";
import { ProductSwitcherService } from "./shared/product-switcher.service";

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

  async getAll() {
    return await firstValueFrom(MockProviderService._providers);
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

export default {
  title: "Web/Product Switcher",
  decorators: [
    moduleMetadata({
      declarations: [
        ProductSwitcherContentComponent,
        ProductSwitcherComponent,
        MockOrganizationService,
        MockProviderService,
        StoryLayoutComponent,
        StoryContentComponent,
      ],
      imports: [JslibModule, MenuModule, IconButtonModule, LinkModule, RouterModule],
      providers: [
        { provide: AccountService, useClass: MockAccountService },
        MockAccountService,
        { provide: OrganizationService, useClass: MockOrganizationService },
        MockOrganizationService,
        { provide: ProviderService, useClass: MockProviderService },
        MockProviderService,
        { provide: SyncService, useClass: MockSyncService },
        { provide: PlatformUtilsService, useClass: MockPlatformUtilsService },
        MockPlatformUtilsService,
        ProductSwitcherService,
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              moreFromBitwarden: "More from Bitwarden",
              switchProducts: "Switch Products",
              secureYourInfrastructure: "Secure your infrastructure",
              protectYourFamilyOrBusiness: "Protect your family or business",
            });
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
          RouterModule.forRoot(
            [
              {
                path: "",
                component: StoryLayoutComponent,
                children: [
                  {
                    path: "",
                    redirectTo: "vault",
                    pathMatch: "full",
                  },
                  {
                    path: "sm/:organizationId",
                    component: StoryContentComponent,
                  },
                  {
                    path: "providers/:providerId",
                    component: StoryContentComponent,
                  },
                  {
                    path: "vault",
                    component: StoryContentComponent,
                  },
                ],
              },
            ],
            { useHash: true },
          ),
        ),
      ],
    }),
  ],
} as Meta<ProductSwitcherComponent>;

type Story = StoryObj<
  ProductSwitcherComponent & MockProviderService & MockOrganizationService & MockAccountService
>;

const Template: Story = {
  render: (args) => ({
    props: args,
    template: `
    <router-outlet [mockOrgs]="mockOrgs" [mockProviders]="mockProviders"></router-outlet>
    <div class="tw-flex tw-gap-[200px]">
      <div>
        <h1 class="tw-text-main tw-text-base tw-underline">Closed</h1>
        <product-switcher></product-switcher>
      </div>
      <div>
        <h1 class="tw-text-main tw-text-base tw-underline">Open</h1>
        <product-switcher-content #content></product-switcher-content>
        <div class="tw-h-40">
          <div class="cdk-overlay-pane bit-menu-panel">
            <ng-container *ngTemplateOutlet="content?.menu?.templateRef"></ng-container>
          </div>
        </div>
      </div>
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

export const WithSM: Story = {
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

export const WithSMAndAC: Story = {
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
