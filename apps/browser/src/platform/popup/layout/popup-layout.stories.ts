// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

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
} from "@bitwarden/components";

import { PopupRouterCacheService } from "../view-cache/popup-router-cache.service";

import { PopupFooterComponent } from "./popup-footer.component";
import { PopupHeaderComponent } from "./popup-header.component";
import { PopupPageComponent } from "./popup-page.component";
import { PopupTabNavigationComponent } from "./popup-tab-navigation.component";

@Component({
  selector: "extension-container",
  template: `
    <div class="tw-h-[640px] tw-w-[380px] tw-border tw-border-solid tw-border-secondary-300">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true,
})
class ExtensionContainerComponent {}

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
              <button type="button" bitIconButton="bwi-clone" aria-label="Copy item"></button>
            </bit-item-action>
            <bit-item-action>
              <button
                type="button"
                bitIconButton="bwi-ellipsis-v"
                aria-label="More options"
              ></button>
            </bit-item-action>
          </ng-container>
        </bit-item>
      </bit-item-group>
    </bit-section>
  `,
  standalone: true,
  imports: [CommonModule, ItemModule, BadgeModule, IconButtonModule, SectionComponent],
})
class VaultComponent {
  protected data = Array.from(Array(20).keys());
}

@Component({
  selector: "mock-add-button",
  template: `
    <button bitButton buttonType="primary" type="button">
      <i class="bwi bwi-plus-f" aria-hidden="true"></i>
      Add
    </button>
  `,
  standalone: true,
  imports: [ButtonModule],
})
class MockAddButtonComponent {}

@Component({
  selector: "mock-popout-button",
  template: `
    <button
      bitIconButton="bwi-popout"
      size="small"
      type="button"
      title="Pop out"
      aria-label="Pop out"
    ></button>
  `,
  standalone: true,
  imports: [IconButtonModule],
})
class MockPopoutButtonComponent {}

@Component({
  selector: "mock-current-account",
  template: `
    <button class="tw-bg-transparent tw-border-none" type="button">
      <bit-avatar text="Ash Ketchum" size="small"></bit-avatar>
    </button>
  `,
  standalone: true,
  imports: [AvatarModule],
})
class MockCurrentAccountComponent {}

@Component({
  selector: "mock-search",
  template: ` <bit-search placeholder="Search"> </bit-search> `,
  standalone: true,
  imports: [SearchModule],
})
class MockSearchComponent {}

@Component({
  selector: "mock-banner",
  template: `
    <bit-banner bannerType="info" [showClose]="false">
      This is an important note about these ciphers
    </bit-banner>
  `,
  standalone: true,
  imports: [BannerModule],
})
class MockBannerComponent {}

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
  standalone: true,
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
  standalone: true,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
    VaultComponent,
  ],
})
class MockVaultPagePoppedComponent {}

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
  standalone: true,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
  ],
})
class MockGeneratorPageComponent {}

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
  standalone: true,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
  ],
})
class MockSendPageComponent {}

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
  standalone: true,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
  ],
})
class MockSettingsPageComponent {}

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
        <button slot="end" type="button" buttonType="danger" bitIconButton="bwi-trash"></button>
      </popup-footer>
    </popup-page>
  `,
  standalone: true,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    ButtonModule,
    MockAddButtonComponent,
    MockPopoutButtonComponent,
    MockCurrentAccountComponent,
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
        PopupTabNavigationComponent,
        PopupHeaderComponent,
        PopupPageComponent,
        PopupFooterComponent,
        CommonModule,
        RouterModule,
        ExtensionContainerComponent,
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

export const PopupTabNavigation: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-tab-navigation>
          <router-outlet></router-outlet>
        </popup-tab-navigation>
      </extension-container>
    `,
  }),
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
      const label = canvasEl.querySelector(`#${containerId} .example-label`);
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
      <div class="tw-h-[640px] tw-w-[900px] tw-border tw-border-solid tw-border-secondary-300">
        <mock-vault-page-popped></mock-vault-page-popped>
      </div>
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
            <div class="tw-h-full tw-flex tw-items-center tw-justify-center tw-text-main">
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

export const TransparentHeader: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <extension-container>
        <popup-page>
          <popup-header slot="header" background="alt"
            ><span class="tw-italic tw-text-main">🤠 Custom Content</span></popup-header
          >

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
