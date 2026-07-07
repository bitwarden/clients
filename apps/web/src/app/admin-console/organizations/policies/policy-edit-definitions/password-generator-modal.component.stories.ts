import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyModalMeta } from "../policy-drawer-story.helper";

import { PasswordGeneratorPolicy } from "./password-generator.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2 design change leaking into the modal. Compare against the drawer
 * stories in password-generator.component.stories.ts.
 */
export default {
  ...policyModalMeta(
    "Admin Console/Organizations/Policies/Password Generator/Modal (flag off)",
    new PasswordGeneratorPolicy(),
  ),
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
