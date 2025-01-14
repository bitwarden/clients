import { Component, Directive, importProvidersFrom, Input } from "@angular/core";
import { RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { LayoutComponent, NavigationModule } from "@bitwarden/components";
import { I18nMockService } from "@bitwarden/components/src/utils/i18n-mock.service";

import { ProductSwitcherService } from "../shared/product-switcher.service";

import { NavigationProductSwitcherComponent } from "./navigation-switcher.component";

@Directive({
  selector: "[mockOrgs]",
})
class MockOrganizationService implements Partial<OrganizationService> {
  private static _orgs = new BehaviorSubject<Organization[]>([]);
  organizations$ = MockOrganizationService._orgs; // eslint-disable-line rxjs/no-exposed-subjects

  @Input()
  set mockOrgs(orgs: Organization[]) {
    this.organizations$.next(orgs);
  }
}

@Directive({
  selector: "[mockProviders]",
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

@Component({
  selector: "story-layout",
  template: `<ng-content></ng-content>`,
})
class StoryLayoutComponent {}

@Component({
  selector: "story-content",
  template: ``,
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
        I18nPipe,
      ],
      imports: [NavigationModule, RouterModule, LayoutComponent],
      providers: [
        { provide: OrganizationService, useClass: MockOrganizationService },
        { provide: ProviderService, useClass: MockProviderService },
        { provide: SyncService, useClass: MockSyncService },
        ProductSwitcherService,
        {
          provide: I18nPipe,
          useFactory: () => ({
            transform: (key: string) => translations[key],
          }),
        },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService(translations);
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
        canAccessExport: (_) => false,
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
        canAccessExport: (_) => false,
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
        canAccessExport: (_) => false,
      },
    ] as Organization[],
    mockProviders: [{ id: "provider-a" }] as Provider[],
  },
};
