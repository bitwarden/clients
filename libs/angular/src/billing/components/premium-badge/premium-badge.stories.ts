import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { BadgeModule, I18nMockService } from "@bitwarden/components";

import { JslibModule } from "../../../jslib.module";

import { PremiumBadgeComponent } from "./premium-badge.component";

// Each story provides its own ConfigService in a child injector so its state stays isolated,
// including on the composed Docs page where stories share a global.
const config = (enabled: boolean) =>
  moduleMetadata({
    providers: [{ provide: ConfigService, useValue: { getFeatureFlag$: () => of(enabled) } }],
  });

export default {
  title: "Billing/Premium Badge",
  component: PremiumBadgeComponent,
  decorators: [
    config(false),
    moduleMetadata({
      imports: [JslibModule, BadgeModule, PremiumBadgeComponent],
      providers: [
        { provide: AccountService, useValue: { activeAccount$: of({ id: "123" }) } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              upgrade: "Upgrade",
              upgradeToPremium: "Upgrade to Premium",
              premium: "Premium",
            }),
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: () => of(false) },
        },
        { provide: PremiumUpgradePromptService, useValue: { promptForPremium: () => {} } },
      ],
    }),
  ],
} as Meta<PremiumBadgeComponent>;

type Story = StoryObj<PremiumBadgeComponent>;

/** Flag off, clickable "Upgrade" chip. */
export const Default: Story = {};

/** Flag off, side-nav icon button, shown on the nav surface it's colored for. */
export const IconOnly: Story = {
  render: () => ({
    template: `
        <div class="tw-inline-block tw-rounded tw-bg-bg-nav tw-p-2">
          <app-premium-badge [iconOnly]="true"></app-premium-badge>
        </div>
    `,
  }),
};

/** Flag on, a plain, non-clickable "Premium" label, shown when no host binds the click. */
export const PremiumLabel: Story = {
  decorators: [config(true)],
};

/** Flag on, a clickable "Premium" chip that emits `clicked`, shown when a host binds a click handler. */
export const PremiumChip: Story = {
  decorators: [config(true)],
  argTypes: { clicked: { action: "clicked" } },
  render: (args) => ({
    props: args,
    template: `<app-premium-badge (clicked)="clicked($event)"></app-premium-badge>`,
  }),
};
