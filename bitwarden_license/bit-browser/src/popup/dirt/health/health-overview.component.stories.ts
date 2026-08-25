import { provideRouter } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { VaultHealthReportView } from "@bitwarden/bit-common/dirt/vault-health/models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { HealthOverviewComponent } from "./health-overview.component";

/** Distinct at-risk logins; the fields are irrelevant to the overview. */
function items(count: number): CipherHealthView[] {
  return Array.from({ length: count }, () => ({}) as CipherHealthView);
}

/** The screenshot's numbers: 63 of 200 at risk, split across the three categories. */
const atRiskReport = new VaultHealthReportView({
  totalCount: 200,
  atRiskCount: 63,
  categoryItems: { exposed: items(6), weak: items(22), reused: items(35) },
});

export default {
  title: "Browser/DIRT/Health/Health Overview",
  component: HealthOverviewComponent,
  decorators: [
    applicationConfig({
      providers: [provideRouter([])],
    }),
    moduleMetadata({
      imports: [],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              atRisk: "at risk",
              atRiskPasswords: "__$1__ of __$2__ passwords at risk",
              yourVaultRiskIsHigh: "Your vault risk is high",
              yourVaultIsHealthy: "Your vault is healthy",
              passwordsNeedFixing: "__$1__ of __$2__ passwords need fixing",
              risksIdentified: "Risks identified",
              upgradeToViewPasswords: "Upgrade to view passwords",
              premiumSubscriptionRequired: "Premium subscription required",
              categoryHealthy: "No items need attention",
              exposedPasswordsNone: "No exposed passwords",
              exposedPassword: "1 exposed password",
              exposedPasswordsPlural: "__$1__ exposed passwords",
              exposedPasswordsDesc: "Exposed in data breaches",
              exposedPasswordsNoneDesc: "None of your passwords were found in data breaches",
              weakPasswordsNone: "No weak passwords",
              weakPassword: "1 weak password",
              weakPasswordsPlural: "__$1__ weak passwords",
              weakPasswordsDesc: "Too short or simple",
              weakPasswordsNoneDesc: "All your passwords are strong",
              reusedPasswordsNone: "No reused passwords",
              reusedPassword: "1 reused password",
              reusedPasswordsPlural: "__$1__ reused passwords",
              reusedPasswordsDesc: "Reused for several logins",
              reusedPasswordsNoneDesc: "All your passwords are unique",
            }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/JZf3F2PRqB7HhflAybw2Xe/Premium-end-user-health?node-id=2368-9777",
    },
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
  args: {
    report: atRiskReport,
    locked: false,
  },
} as Meta<HealthOverviewComponent>;

type Story = StoryObj<HealthOverviewComponent>;

/** Premium: every category navigates to its detail list. */
export const Premium: Story = {};

/**
 * Free: the categories are locked and an upgrade button closes out the card.
 * This is the story that shows the button sharing the categories' card rather
 * than sitting on the page background.
 */
export const FreeUser: Story = {
  args: {
    locked: true,
  },
};

/** Free with a clean vault: still locked, and the upgrade button still shows. */
export const FreeUserHealthy: Story = {
  args: {
    locked: true,
    report: new VaultHealthReportView({ totalCount: 200, atRiskCount: 0 }),
  },
};
