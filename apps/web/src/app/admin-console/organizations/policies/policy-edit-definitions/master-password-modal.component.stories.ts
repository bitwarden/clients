import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyModalMeta } from "../policy-drawer-story.helper";

import { MasterPasswordPolicy } from "./master-password.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy. This is the exact
 * regression that leaked v2 design (badge, description, MasterPasswordPolicyV2Component) into the
 * modal - this story exists so a visual diff (e.g. via Chromatic) catches it automatically going
 * forward. Compare against the drawer stories in master-password.component.stories.ts.
 */
export default {
  ...policyModalMeta(new MasterPasswordPolicy()),
  title: "Admin Console/Organizations/Policies/Master Password/Modal (flag off)",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
