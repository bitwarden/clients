import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, I18nMockService } from "@bitwarden/components";
import { UpgradeNavButtonComponent } from "@bitwarden/web-vault/app/billing/individual/upgrade/upgrade-nav-button/upgrade-nav-button/upgrade-nav-button.component";

export default {
  title: "Billing/Upgrade Navigation Button",
  component: UpgradeNavButtonComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              upgradeYourPlan: "Upgrade your plan",
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

type Story = StoryObj<UpgradeNavButtonComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="tw-p-4 tw-bg-background-alt3">
        <app-upgrade-nav-button></app-upgrade-nav-button>
      </div>
    `,
  }),
};
