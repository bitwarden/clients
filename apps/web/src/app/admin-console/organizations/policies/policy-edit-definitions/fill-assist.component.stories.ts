import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { FillAssistPolicy } from "./fill-assist.component";

const baseMeta = policyDrawerMeta(new FillAssistPolicy());

export default {
  ...baseMeta,
  title: "Admin Console/Organizations/Policies/Activate fill assist",
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
