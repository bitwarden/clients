import { Meta, StoryObj } from "@storybook/angular";

import {
  PolicyDialogStoryArgs,
  policyDrawerMeta,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-drawer-story.helper";

import { AutomaticAppLoginPolicy } from "./automatic-app-login.component";

export default {
  ...policyDrawerMeta(new AutomaticAppLoginPolicy()),
  title: "Admin Console/Organizations/Policies/Automatic App Login",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
