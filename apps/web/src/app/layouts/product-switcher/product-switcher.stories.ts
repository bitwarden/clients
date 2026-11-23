import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  effect,
  importProvidersFrom,
  input,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, Observable, of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ProviderService, Provider } from "@bitwarden/common/provider";
import { UserId } from "@bitwarden/common/types/guid";
import { IconButtonModule, LinkModule, MenuModule } from "@bitwarden/components";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { I18nMockService } from "@bitwarden/components/src/utils/i18n-mock.service";
import { enabledFlags } from "@bitwarden/storybook";

import { ProductSwitcherContentComponent } from "./product-switcher-content.component";
import { ProductSwitcherComponent } from "./product-switcher.component";
import { ProductSwitcherService } from "./shared/product-switcher.service";

const mockOrgs$ = new BehaviorSubject<Organization[]>([]);
const mockProviders$ = new BehaviorSubject<Provider[]>([]);

class MockOrganizationService implements Partial<OrganizationService> {
  organizations$(): Observable<Organization[]> {
    return mockOrgs$.asObservable();
  }
}

class MockProviderService implements Partial<ProviderService> {
  providers$() {
    return mockProviders$.asObservable();
  }
}

/** Feeds the story's `mockOrgs` arg into the mock organization service. */
@Directive({
  selector: "[mockOrgs]",
  standalone: false,
})
class MockOrgsDirective {
  readonly mockOrgs = input<Organization[]>([]);

  constructor() {
    effect(() => mockOrgs$.next(this.mockOrgs()));
  }
}

/** Feeds the story's `mockProviders` arg into the mock provider service. */
@Directive({
  selector: "[mockProviders]",
  standalone: false,
})
class MockProvidersDirective {
  readonly mockProviders = input<Provider[]>([]);

  constructor() {
    effect(() => mockProviders$.next(this.mockProviders()));
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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "story-layout",
  template: `<ng-content></ng-content>`,
  standalone: false,
})
class StoryLayoutComponent {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
        MockOrgsDirective,
        MockProvidersDirective,
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
        {
          provide: BillingAccountProfileStateService,
          useClass: MockBillingAccountProfileStateService,
        },
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
              loading: "Loading",
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
  ProductSwitcherComponent & MockProvidersDirective & MockOrgsDirective & MockAccountService
>;

const Template: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
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
            <ng-container *ngTemplateOutlet="content.menu()?.templateRef()"></ng-container>
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

/** Under VFO1, the Organizations entry point is removed from the switcher. */
export const Vfo1Foundation: Story = {
  ...OnlyPM,
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
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
