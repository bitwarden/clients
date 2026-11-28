import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { VaultHealthReportStatus } from "@bitwarden/common/dirt/vault-health/models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, ItemModule } from "@bitwarden/components";

import { PasskeyOpportunityNavItemComponent } from "./passkey-opportunity-nav-item.component";

export default {
  title: "Browser/DIRT/Health/Passkey Opportunity Nav Item",
  component: PasskeyOpportunityNavItemComponent,
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule, ItemModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              passkeyOpportunitiesNone: "No passkey upgrades",
              passkeyOpportunity: "1 login can use a passkey",
              passkeyOpportunitiesPlural: "__$1__ logins can use passkeys",
              passkeyOpportunitiesDesc: "Log in more safely on these sites",
              passkeyOpportunitiesNoneDesc: "No saved logins are waiting for a passkey",
              passkeyOpportunitiesChecking: "Checking for passkey support...",
              passkeyOpportunitiesFailed: "Passkey support couldn't be checked",
              passkeyOpportunitiesFailedDesc: "An error occurred. Please try again.",
              passkeyOpportunitiesLocked: "Logins that can use passkeys",
              passkeyOpportunitiesLockedDesc: "See which sites support passkeys with Premium",
              tryAgain: "Try again",
              categoryHealthy: "No items need attention",
              premiumSubscriptionRequired: "Premium subscription required",
            }),
        },
      ],
    }),
  ],
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
  args: {
    status: VaultHealthReportStatus.Success,
    count: 4,
    locked: false,
  },
  // The component renders the item content only, so the wrapper supplies the
  // <bit-item> the row sits in on the Health Overview.
  render: (args) => ({
    props: args,
    template: `
      <bit-item-group>
        <bit-item>
          <dirt-passkey-opportunity-nav-item [status]="status" [count]="count" [locked]="locked" />
        </bit-item>
      </bit-item-group>
    `,
  }),
} as Meta<PasskeyOpportunityNavItemComponent>;

type Story = StoryObj<PasskeyOpportunityNavItemComponent>;

/** Logins whose sites support passkeys: a regular category row linking to the list. */
export const Available: Story = {};

/** None found: the row still renders, with the check tile. */
export const NoneAvailable: Story = { args: { count: 0 } };

/** The passkey directory is still loading. */
export const Checking: Story = {
  args: { status: VaultHealthReportStatus.Loading, count: null },
};

/** The passkey directory could not be fetched; the row offers a retry. */
export const DirectoryFetchFailed: Story = {
  args: { status: VaultHealthReportStatus.Error, count: null },
};

/**
 * Free user: locked like the other Health categories. No count, because a free
 * user is never checked against the passkey directory.
 */
export const Locked: Story = {
  args: { status: VaultHealthReportStatus.Idle, count: null, locked: true },
};
