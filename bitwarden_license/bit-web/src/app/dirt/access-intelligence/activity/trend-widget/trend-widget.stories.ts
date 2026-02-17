import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { IconButtonModule } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { TrendWidgetComponent } from "./trend-widget.component";

export default {
  title: "Web/Access Intelligence/Trend Widget",
  component: TrendWidgetComponent,
  decorators: [
    moduleMetadata({
      imports: [IconButtonModule],
      providers: [
        // {
        //   provide: AccountService,
        //   useValue: {
        //     activeAccount$: of({
        //       id: "123",
        //     }),
        //   },
        // },
        // {
        //   provide: I18nService,
        //   useFactory: () => {
        //     return new I18nMockService({
        //       premium: "Premium",
        //       upgrade: "Upgrade",
        //     });
        //   },
        // },
        // {
        //   provide: BillingAccountProfileStateService,
        //   useValue: {
        //     hasPremiumFromAnySource$: () => of(false),
        //   },
        // },
        // {
        //   provide: PremiumUpgradePromptService,
        //   useValue: {
        //     promptForPremium: (orgId?: string) => {},
        //   },
        // },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  args: {
    // title: "Exposed Passwords",
    // description:
    //   "Passwords exposed in a data breach are easy targets for attackers. Change these passwords to prevent potential break-ins.",
    // icon: "reportExposedPasswords",
    // variant: ReportVariant.Enabled,
  },
} as Meta;

type Story = StoryObj<TrendWidgetComponent>;

export const Default: Story = {};
