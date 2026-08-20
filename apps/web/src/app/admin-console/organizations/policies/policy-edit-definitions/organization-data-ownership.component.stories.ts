import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { OrganizationDataOwnershipPolicy } from "./organization-data-ownership.component";

export default {
  ...policyDrawerMeta(new OrganizationDataOwnershipPolicy()),
  title: "Admin Console/Organizations/Policies/Organization Data Ownership",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
