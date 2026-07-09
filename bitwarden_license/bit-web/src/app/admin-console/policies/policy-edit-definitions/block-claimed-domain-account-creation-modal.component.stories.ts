import { Meta, StoryObj } from "@storybook/angular";

import {
  PolicyDialogStoryArgs,
  policyModalMeta,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-drawer-story.helper";

import { BlockClaimedDomainAccountCreationPolicy } from "./block-claimed-domain-account-creation.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2 design change leaking into the modal. Compare against the drawer
 * stories in block-claimed-domain-account-creation.component.stories.ts.
 */
export default {
  ...policyModalMeta(new BlockClaimedDomainAccountCreationPolicy()),
  title:
    "Admin Console/Organizations/Policies/Block Claimed Domain Account Creation/Modal (flag off)",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
