import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyModalMeta } from "../policy-drawer-story.helper";

import { OrganizationDataOwnershipPolicy } from "./organization-data-ownership.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2 design change leaking into the modal. Compare against the drawer
 * stories in organization-data-ownership.component.stories.ts.
 */
export default {
  ...policyModalMeta(new OrganizationDataOwnershipPolicy()),
  title: "Admin Console/Organizations/Policies/Organization Data Ownership/Modal (flag off)",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
