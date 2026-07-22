import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { RestrictedItemTypesPolicy } from "./restricted-item-types.component";

export default {
  ...policyDrawerMeta(new RestrictedItemTypesPolicy()),
  title: "Admin Console/Organizations/Policies/Restricted Item Types",
} satisfies Meta<PolicyDrawerStoryArgs>;

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
