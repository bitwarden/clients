import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyModalMeta } from "../policy-drawer-story.helper";

import { RequireSsoPolicy } from "./require-sso.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2-only design change leaking into the modal. Compare against the
 * drawer stories in require-sso.component.stories.ts.
 */
export default {
  ...policyModalMeta(
    "Admin Console/Organizations/Policies/Require SSO/Modal (flag off)",
    new RequireSsoPolicy(),
  ),
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
