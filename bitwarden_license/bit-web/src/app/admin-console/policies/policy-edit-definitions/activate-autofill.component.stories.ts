import { Meta, StoryObj } from "@storybook/angular";

import {
  PolicyDialogStoryArgs,
  policyDrawerMeta,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-drawer-story.helper";

import { ActivateAutofillPolicy } from "./activate-autofill.component";

export default {
  ...policyDrawerMeta(new ActivateAutofillPolicy()),
  title: "Admin Console/Organizations/Policies/Activate Autofill",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
