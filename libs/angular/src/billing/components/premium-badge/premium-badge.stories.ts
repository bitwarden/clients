import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { BadgeModule, I18nMockService } from "@bitwarden/components";

import { PremiumBadgeComponent } from "./premium-badge.component";

export default {
  title: "Billing/Premium Badge",
  component: PremiumBadgeComponent,
  decorators: [
    moduleMetadata({
      imports: [JslibModule, BadgeModule],
      providers: [
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: "123",
            }),
          },
        },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              premium: "Premium",
            });
          },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: {
            hasPremiumFromAnySource$: () => of(false),
          },
        },
        {
          provide: PremiumUpgradePromptService,
          useValue: {
            promptForPremium: (orgId?: string) => {},
          },
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<PremiumBadgeComponent>;

export const Primary: Story = {};
