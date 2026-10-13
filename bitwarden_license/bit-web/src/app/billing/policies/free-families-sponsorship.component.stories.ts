import { Meta, StoryObj } from "@storybook/angular";

import {
  PolicyDrawerStoryArgs,
  policyDrawerMeta,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-drawer-story.helper";

import { FreeFamiliesSponsorshipPolicy } from "./free-families-sponsorship.component";

export default {
  ...policyDrawerMeta(new FreeFamiliesSponsorshipPolicy()),
  title: "Admin Console/Organizations/Policies/Free Families Sponsorship",
} satisfies Meta<PolicyDrawerStoryArgs>;

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
