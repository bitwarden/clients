import { StoryObj } from "@storybook/angular";

import { PolicyDrawerStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { RemoveUnlockWithPinPolicy } from "./remove-unlock-with-pin.component";

export default {
  ...policyDrawerMeta(new RemoveUnlockWithPinPolicy()),
  title: "Admin Console/Organizations/Policies/Remove Unlock With PIN",
};

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
