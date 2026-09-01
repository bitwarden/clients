import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";
import { UpgradeFlowService } from "@bitwarden/web-vault/app/billing/individual/upgrade/services/upgrade-flow.service";
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
          provide: UpgradeFlowService,
          useValue: {
            calloutDismissed$: of(false),
            upgrade: () => Promise.resolve(),
            dismissCallout: () => Promise.resolve(),
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
