import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyModalMeta } from "../policy-drawer-story.helper";

import { TwoFactorAuthenticationPolicy } from "./two-factor-authentication.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2-only design change leaking into the modal. Compare against the
 * drawer stories in two-factor-authentication.component.stories.ts.
 */
export default {
  ...policyModalMeta(new TwoFactorAuthenticationPolicy()),
  title: "Admin Console/Organizations/Policies/Two Factor Authentication/Modal (flag off)",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
