import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyModalMeta } from "../policy-drawer-story.helper";

import { FillAssistPolicy } from "./fill-assist.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any drawer-only design change leaking into the modal.
 */
const baseMeta = policyModalMeta(new FillAssistPolicy());

export default {
  ...baseMeta,
  title: "Admin Console/Organizations/Policies/Activate Fill Assist/Modal (flag off)",
  args: { ...baseMeta.args, isCloud: true },
  argTypes: { ...baseMeta.argTypes, isCloud: { control: "boolean" } },
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {
  args: {
    isCloud: true,
  },
};

export const PolicyOn: Story = {
  args: {
    enabled: true,
    isCloud: true,
  },
};
