import { Component, Directive, importProvidersFrom, Input } from "@angular/core";
import { RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, Story } from "@storybook/angular";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconButtonModule, LinkModule, MenuModule } from "@bitwarden/components";
import { I18nMockService } from "@bitwarden/components/src/utils/i18n-mock.service";

import { ProductSwitcherContentComponent } from "./product-switcher-content.component";
import { ProductSwitcherComponent } from "./product-switcher.component";

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
        { provide: OrganizationService, useClass: MockOrganizationService },
        MockOrganizationService,
        { provide: ProviderService, useClass: MockProviderService },
        MockProviderService,
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              moreFromBitwarden: "More from Bitwarden",
              switchProducts: "Switch Products",
            });
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
} as Meta;

const Template: Story = (args) => ({
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
});

export const OnlyPM = Template.bind({});
OnlyPM.args = {
  mockOrgs: [],
  mockProviders: [],
};

export const WithSM = Template.bind({});
WithSM.args = {
  mockOrgs: [{ id: "org-a", canManageUsers: false, canAccessSecretsManager: true, enabled: true }],
  mockProviders: [],
};

export const WithSMAndAC = Template.bind({});
WithSMAndAC.args = {
  mockOrgs: [{ id: "org-a", canManageUsers: true, canAccessSecretsManager: true, enabled: true }],
  mockProviders: [],
};

export const WithAllOptions = Template.bind({});
WithAllOptions.args = {
  mockOrgs: [{ id: "org-a", canManageUsers: true, canAccessSecretsManager: true, enabled: true }],
  mockProviders: [{ id: "provider-a" }],
};
