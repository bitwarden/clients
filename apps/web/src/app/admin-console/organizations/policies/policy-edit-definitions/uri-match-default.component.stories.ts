import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyDrawerMeta } from "../policy-drawer-story.helper";

import { UriMatchDefaultPolicy } from "./uri-match-default.component";

export default {
  ...policyDrawerMeta(new UriMatchDefaultPolicy()),
  title: "Admin Console/Organizations/Policies/Default URI Match Detection",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
