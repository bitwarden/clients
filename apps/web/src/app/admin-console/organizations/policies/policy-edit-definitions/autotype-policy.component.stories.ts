import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { DesktopAutotypeDefaultSettingPolicy } from "./autotype-policy.component";

export default {
  ...policyDrawerMeta(
    "Admin Console/Organizations/Policies/Desktop Autotype Default Setting",
    new DesktopAutotypeDefaultSettingPolicy(),
  ),
} satisfies Meta<PolicyDrawerStoryArgs>;

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
