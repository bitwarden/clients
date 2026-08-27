import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, I18nMockService } from "@bitwarden/components";
import { UpgradeCalloutComponent } from "@bitwarden/web-vault/app/billing/individual/upgrade/upgrade-nav-button/upgrade-callout/upgrade-callout.component";

export default {
  title: "Billing/Upgrade Callout",
  component: UpgradeCalloutComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              upgradeYourPlan: "Upgrade your plan",
              upgradeNow: "Upgrade now",
              getAdvancedOnlineSecurityWithBitwardenPremium:
                "Get advanced online security with Bitwarden premium.",
              close: "Close",
            });
          },
        },
        {
          provide: DialogService,
          useValue: {
            open: () => ({
              closed: of({}),
            }),
          },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: "user-id" as UserId,
              email: "test@example.com",
              name: "Test User",
              emailVerified: true,
            }),
          },
        },
        {
          provide: SyncService,
          useValue: {
            fullSync: () => {},
          },
        },
        {
          provide: PlatformUtilsService,
          useValue: {
            isSelfHost: () => false,
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/nuFrzHsgEoEk2Sm8fWOGuS/Premium---business-upgrade-flows?node-id=858-44274&t=EiNqDGuccfhF14on-1",
    },
  },
} as Meta;

type Story = StoryObj<UpgradeCalloutComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-w-64 tw-py-4 tw-bg-bg-nav">
        <app-upgrade-callout></app-upgrade-callout>
      </div>
    `,
  }),
};
