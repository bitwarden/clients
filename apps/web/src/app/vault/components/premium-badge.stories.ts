import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { BadgeModule, I18nMockService } from "@bitwarden/components";

import { PremiumBadgeComponent } from "./premium-badge.component";

class MockMessagingService implements MessageSender {
  send = () => {
    alert("Clicked on badge");
  };
}

export default {
  title: "Web/Premium Badge",
  component: PremiumBadgeComponent,
  decorators: [
    moduleMetadata({
      imports: [JslibModule, BadgeModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              premium: "Premium",
            });
          },
        },
        {
          provide: MessageSender,
          useFactory: () => {
            return new MockMessagingService();
          },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: {
            hasPremiumFromAnySource$: of(false),
          },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: "test-user-id" as UserId,
              name: "Test User 1",
              email: "test@email.com",
              emailVerified: true,
            }),
          },
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<PremiumBadgeComponent>;

export const Primary: Story = {};
