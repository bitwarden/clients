import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyModalMeta } from "../policy-drawer-story.helper";

import { AutoConfirmPolicy } from "./auto-confirm-policy.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2-only design change (toggle, risk checkbox, footer button, badge)
 * leaking into the modal. Compare against the drawer stories in
 * auto-confirm-policy.component.stories.ts.
 */
export default {
  ...policyModalMeta(new AutoConfirmPolicy()),
  title: "Admin Console/Organizations/Policies/Auto-confirm/Modal (flag off)",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
