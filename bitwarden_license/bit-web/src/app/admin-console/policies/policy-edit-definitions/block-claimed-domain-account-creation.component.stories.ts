import { Meta, StoryObj } from "@storybook/angular";

import {
  PolicyDrawerStoryArgs,
  policyDrawerMeta,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-drawer-story.helper";

import { BlockClaimedDomainAccountCreationPolicy } from "./block-claimed-domain-account-creation.component";

export default {
  ...policyDrawerMeta(new BlockClaimedDomainAccountCreationPolicy()),
  title: "Admin Console/Organizations/Policies/Block Claimed Domain Account Creation",
} satisfies Meta<PolicyDrawerStoryArgs>;

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
