import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyModalMeta } from "../policy-drawer-story.helper";

import { FillAssistPolicy } from "./fill-assist.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any drawer-only design change leaking into the modal.
 */
export default {
  ...policyModalMeta(new FillAssistPolicy()),
  title: "Admin Console/Organizations/Policies/Activate Fill Assist/Modal (flag off)",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
