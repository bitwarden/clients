import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { FillAssistPolicy } from "./fill-assist.component";

export default {
  ...policyDrawerMeta(new FillAssistPolicy()),
  title: "Admin Console/Organizations/Policies/Fill Assist",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
