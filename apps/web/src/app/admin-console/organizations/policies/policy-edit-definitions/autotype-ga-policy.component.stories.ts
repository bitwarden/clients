import { StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { DesktopAutotypeGaPolicy } from "./autotype-ga-policy.component";

export default {
  ...policyDrawerMeta(new DesktopAutotypeGaPolicy()),
  title: "Admin Console/Organizations/Policies/Desktop App Autofill",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
