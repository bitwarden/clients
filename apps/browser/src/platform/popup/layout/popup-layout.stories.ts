import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { Component, importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import {
  GeneratorActive,
  GeneratorInactive,
  SendActive,
  SendInactive,
  SettingsActive,
  SettingsInactive,
  VaultActive,
  VaultInactive,
} from "@bitwarden/assets/svg";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import {
  AvatarModule,
  BadgeModule,
  BannerModule,
  ButtonModule,
  I18nMockService,
  IconButtonModule,
  ItemModule,
  NoItemsModule,
  SearchModule,
  SectionComponent,
  ScrollLayoutDirective,
} from "@bitwarden/components";

import { VaultLoadingSkeletonComponent } from "../../../vault/popup/components/vault-loading-skeleton/vault-loading-skeleton.component";
import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

import { PopupFooterComponent } from "./popup-footer.component";
import { PopupHeaderComponent } from "./popup-header.component";
import { PopupPageComponent } from "./popup-page.component";
import { PopupTabNavigationComponent } from "./popup-tab-navigation.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "extension-container",
  template: `
    <div class="tw-h-[640px] tw-w-[380px] tw-border tw-border-solid tw-border-secondary-300">
      <ng-content></ng-content>
    </div>
  `,
})
class ExtensionContainerComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "extension-popped-container",
  template: `
    <div class="tw-h-[640px] tw-w-[900px] tw-border tw-border-solid tw-border-secondary-300">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true,
})
class ExtensionPoppedContainerComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-placeholder",
  template: /*html*/ `
    <bit-section>
      <bit-item-group aria-label="Mock Vault Items">
        <bit-item *ngFor="let item of data; index as i">
          <button type="button" bit-item-content>
            <i slot="start" class="bwi bwi-globe tw-text-3xl tw-text-muted" aria-hidden="true"></i>
            {{ i }} of {{ data.length - 1 }}
            <span slot="secondary">Bar</span>
          </button>

          <ng-container slot="end">
            <bit-item-action>
              <button type="button" bitBadge variant="primary">Fill</button>
            </bit-item-action>
            <bit-item-action>
              <button type="button" bitIconButton="bwi-clone" label="Copy item"></button>
            </bit-item-action>
            <bit-item-action>
              <button type="button" bitIconButton="bwi-ellipsis-v" label="More options"></button>
            </bit-item-action>
          </ng-container>
        </bit-item>
      </bit-item-group>
    </bit-section>
  `,
  imports: [CommonModule, ItemModule, BadgeModule, IconButtonModule, SectionComponent],
})
class VaultComponent {
  protected data = Array.from(Array(20).keys());
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-add-button",
  template: `
    <button bitButton size="small" buttonType="primary" type="button">
      <i class="bwi bwi-plus" aria-hidden="true"></i>
      Add
    </button>
  `,
  imports: [ButtonModule],
})
class MockAddButtonComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-popout-button",
  template: `
    <button bitIconButton="bwi-popout" size="small" type="button" label="Pop out"></button>
  `,
  imports: [IconButtonModule],
})
class MockPopoutButtonComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-current-account",
  template: `
    <button class="tw-bg-transparent tw-border-none tw-p-0 tw-me-1 tw-align-middle" type="button">
      <bit-avatar text="Ash Ketchum" size="small"></bit-avatar>
    </button>
  `,
  imports: [AvatarModule],
})
class MockCurrentAccountComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-search",
  template: ` <bit-search placeholder="Search"> </bit-search> `,
  imports: [SearchModule],
})
class MockSearchComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-banner",
  template: `
    <bit-banner bannerType="info" [showClose]="false">
      This is an important note about these ciphers
    </bit-banner>
  `,
  imports: [BannerModule],
})
class MockBannerComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-vault-page",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <mock-search slot="above-scroll-area"></mock-search>
      <vault-placeholder></vault-placeholder>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
    MockSearchComponent,
    VaultComponent,
  ],
})
class MockVaultPageComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-vault-page-popped",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <vault-placeholder></vault-placeholder>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockCurrentAccountComponent,
    VaultComponent,
  ],
})
class MockVaultPagePoppedComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-generator-page",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <div class="tw-text-main">Generator content here</div>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
  ],
})
class MockGeneratorPageComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-send-page",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <div class="tw-text-main">Send content here</div>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
  ],
})
class MockSendPageComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-settings-page",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test">
        <ng-container slot="end">
          <mock-add-button></mock-add-button>
          <mock-popout-button></mock-popout-button>
          <mock-current-account></mock-current-account>
        </ng-container>
      </popup-header>
      <div class="tw-text-main">Settings content here</div>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
  ],
})
class MockSettingsPageComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "mock-vault-subpage",
  template: `
    <popup-page>
      <popup-header slot="header" pageTitle="Test" showBackButton>
        <ng-container slot="end">
          <mock-popout-button></mock-popout-button>
        </ng-container>
      </popup-header>
      <vault-placeholder></vault-placeholder>
      <popup-footer slot="footer">
        <button type="button" bitButton buttonType="primary">Save</button>
        <button type="button" bitButton buttonType="secondary">Cancel</button>
        <button
          slot="end"
          type="button"
          buttonType="danger"
          bitIconButton="bwi-trash"
          label="Delete"
        ></button>
      </popup-footer>
    </popup-page>
  `,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    ButtonModule,
    MockPopoutButtonComponent,
    VaultComponent,
    IconButtonModule,
  ],
})
class MockVaultSubpageComponent {}

export default {
  title: "Browser/Popup Layout",
  component: PopupPageComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-38889&t=k6OTDDPZOTtypRqo-11",
    },
  },
  decorators: [
    moduleMetadata({
      imports: [
        ScrollLayoutDirective,
        PopupTabNavigationComponent,
        PopupHeaderComponent,
        PopupPageComponent,
        PopupFooterComponent,
        CommonModule,
        RouterModule,
        ExtensionContainerComponent,
        ExtensionPoppedContainerComponent,
        MockBannerComponent,
        MockSearchComponent,
        MockVaultSubpageComponent,
        MockVaultPageComponent,
        MockSendPageComponent,
        MockGeneratorPageComponent,
        MockSettingsPageComponent,
        MockVaultPagePoppedComponent,
        NoItemsModule,
        VaultComponent,
        ScrollingModule,
        ItemModule,
        SectionComponent,
        IconButtonModule,
        BadgeModule,
        VaultLoadingSkeletonComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              back: "Back",
              loading: "Loading",
              search: "Search",
              vault: "Vault",
              generator: "Generator",
              send: "Send",
              settings: "Settings",
              labelWithNotification: (label: string | undefined) => `${label}: New Notification`,
            });
          },
        },
        {
          provide: PolicyService,
          useFactory: () => {
            return {
              policyAppliesToActiveUser$: () => {
                return {
                  pipe: () => ({
                    subscribe: () => ({}),
                  }),
                };
              },
            };
          },
        },
        {
          provide: SendService,
          useFactory: () => {
            return {
              sends$: () => {
                return { pipe: () => ({}) };
              },
            };
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(
          RouterModule.forRoot(
            [
              { path: "", redirectTo: "tabs/vault", pathMatch: "full" },
              { path: "tabs/vault", component: MockVaultPageComponent },
              { path: "tabs/generator", component: MockGeneratorPageComponent },
              { path: "tabs/send", component: MockSendPageComponent },
              { path: "tabs/settings", component: MockSettingsPageComponent },
              // in case you are coming from a story that also uses the router
              { path: "**", redirectTo: "tabs/vault" },
            ],
            { useHash: true },
          ),
        ),
        {
          provide: PopupRouterCacheService,
          useValue: {
            back() {},
          } as Partial<PopupRouterCacheService>,
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<PopupPageComponent>;

type PopupTabNavigationStory = StoryObj<PopupTabNavigationComponent>;

const navButtons = (showBerry = false) => [
  {
    label: "vault",
    page: "/tabs/vault",
    icon: VaultInactive,
    iconActive: VaultActive,
  },
  {
    label: "generator",
    page: "/tabs/generator",
    icon: GeneratorInactive,
    iconActive: GeneratorActive,
  },
  {
    label: "send",
    page: "/tabs/send",
    icon: SendInactive,
    iconActive: SendActive,
  },
  {
    label: "settings",
    page: "/tabs/settings",
    icon: SettingsInactive,
    iconActive: SettingsActive,
    showBerry: showBerry,
  },
];

export const DefaultPopupTabNavigation: PopupTabNavigationStory = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <extension-container>
        <popup-tab-navigation [navButtons]="navButtons">
          <router-outlet></router-outlet>
        </popup-tab-navigation>
      </extension-container>`,
  }),
  args: {
    navButtons: navButtons(),
  },
};

export const PopupTabNavigationWithBerry: PopupTabNavigationStory = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <extension-container>
        <popup-tab-navigation [navButtons]="navButtons">
          <router-outlet></router-outlet>
        </popup-tab-navigation>
      </extension-container>`,
  }),
  args: {
    navButtons: navButtons(true),
  },
};

export const PopupPage: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <mock-vault-page></mock-vault-page>
      </extension-container>
    `,
  }),
};

export const PopupPageWithFooter: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <mock-vault-subpage></mock-vault-subpage>
      </extension-container>
    `,
  }),
};

export const CompactMode: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <div class="tw-flex tw-gap-6 tw-text-main">
        <div id="regular-example">
          <p>Relaxed</p>
          <p class="example-label"></p>
          <extension-container>
            <mock-vault-subpage></mock-vault-subpage>
          </extension-container>
        </div>

        <div id="compact-example" class="tw-bit-compact">
          <p>Compact</p>
          <p class="example-label"></p>
          <extension-container>
            <mock-vault-subpage></mock-vault-subpage>
          </extension-container>
        </div>
      </div>
    `,
  }),
  play: async (context) => {
    const canvasEl = context.canvasElement;
    const updateLabel = (containerId: string) => {
      const compact = canvasEl.querySelector(
        `#${containerId} [data-testid=popup-layout-scroll-region]`,
      );

      if (!compact) {
        // eslint-disable-next-line
        console.error(`#${containerId} [data-testid=popup-layout-scroll-region] not found`);
        return;
      }

      const label = canvasEl.querySelector(`#${containerId} .example-label`);

      if (!label) {
        // eslint-disable-next-line
        console.error(`#${containerId} .example-label not found`);
        return;
      }

      const percentVisible =
        100 -
        Math.round((100 * (compact.scrollHeight - compact.clientHeight)) / compact.scrollHeight);
      label.textContent = `${percentVisible}% above the fold`;
    };
    updateLabel("compact-example");
    updateLabel("regular-example");
  },
};

export const PoppedOut: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-popped-container>
        <mock-vault-page-popped></mock-vault-page-popped>
      </extension-popped-container>
    `,
  }),
};

export const CenteredContent: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-tab-navigation>
          <popup-page>
            <popup-header slot="header" pageTitle="Centered Content"></popup-header>
            <div
              class="tw-h-full tw-flex tw-items-center tw-justify-center tw-text-main tw-flex-col"
            >
              <h2 bitTypography="h2" class="tw-mb-6">Page with no content</h2>
              <bit-no-items>
                <ng-container slot="title">Before centering a div</ng-container>
                <ng-container slot="description">One must first center oneself</ng-container>
              </bit-no-items>
            </div>
          </popup-page>
        </popup-tab-navigation>
      </extension-container>
    `,
  }),
};

export const Loading: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-tab-navigation>
          <popup-page [loading]="true">
            <popup-header slot="header" pageTitle="Page Header"></popup-header>
            Content would go here
          </popup-page>
        </popup-tab-navigation>
      </extension-container>
    `,
  }),
};

export const SkeletonLoading: Story = {
  render: (args) => ({
    props: { ...args, data: Array(8) },
    template: /* HTML */ `
      <extension-container>
        <popup-tab-navigation>
          <popup-page hideOverflow>
            <popup-header slot="header" pageTitle="Page Header"></popup-header>
            <vault-loading-skeleton></vault-loading-skeleton>
          </popup-page>
        </popup-tab-navigation>
      </extension-container>
    `,
  }),
};

export const TransparentHeader: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-page>
          <popup-header slot="header" background="alt">
            <span class="tw-italic tw-text-main">🤠 Custom Content</span>
          </popup-header>
          <vault-placeholder></vault-placeholder>
        </popup-page>
      </extension-container>
    `,
  }),
};

export const Notice: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-page>
          <popup-header slot="header" pageTitle="Page Header"></popup-header>
          <mock-banner slot="full-width-notice"></mock-banner>
          <mock-search slot="above-scroll-area"></mock-search>
          <vault-placeholder></vault-placeholder>
        </popup-page>
      </extension-container>
    `,
  }),
};

export const WidthOptions: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <div class="tw-flex tw-flex-col tw-gap-4 tw-text-main">
        <div>Default:</div>
        <div class="tw-h-[640px] tw-w-[380px] tw-border tw-border-solid tw-border-secondary-300">
          <mock-vault-page></mock-vault-page>
        </div>
        <div>Wide:</div>
        <div class="tw-h-[640px] tw-w-[480px] tw-border tw-border-solid tw-border-secondary-300">
          <mock-vault-page></mock-vault-page>
        </div>
        <div>Extra wide:</div>
        <div class="tw-h-[640px] tw-w-[600px] tw-border tw-border-solid tw-border-secondary-300">
          <mock-vault-page></mock-vault-page>
        </div>
      </div>
    `,
  }),
};

export const WithVirtualScrollChild: Story = {
  render: (args) => ({
    props: { ...args, data: Array.from(Array(20).keys()) },
    template: /* HTML */ `
      <extension-popped-container>
        <popup-page>
          <popup-header slot="header" pageTitle="Test"> </popup-header>
          <mock-search slot="above-scroll-area"></mock-search>
          <bit-section>
            @defer (on immediate) {
            <bit-item-group aria-label="Mock Vault Items">
              <cdk-virtual-scroll-viewport itemSize="59" bitScrollLayout>
                <bit-item *cdkVirtualFor="let item of data; index as i">
                  <button type="button" bit-item-content>
                    <i
                      slot="start"
                      class="bwi bwi-globe tw-text-3xl tw-text-muted"
                      aria-hidden="true"
                    ></i>
                    {{ i }} of {{ data.length - 1 }}
                    <span slot="secondary">Bar</span>
                  </button>

                  <ng-container slot="end">
                    <bit-item-action>
                      <button type="button" bitBadge variant="primary">Fill</button>
                    </bit-item-action>
                    <bit-item-action>
                      <button type="button" bitIconButton="bwi-clone" label="Copy item"></button>
                    </bit-item-action>
                    <bit-item-action>
                      <button
                        type="button"
                        bitIconButton="bwi-ellipsis-v"
                        label="More options"
                      ></button>
                    </bit-item-action>
                  </ng-container>
                </bit-item>
              </cdk-virtual-scroll-viewport>
            </bit-item-group>
            }
          </bit-section>
        </popup-page>
      </extension-popped-container>
    `,
  }),
};
