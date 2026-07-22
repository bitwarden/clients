import { StoryObj } from "@storybook/angular";

import {
  PolicyDrawerStoryArgs,
  policyDrawerMeta,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-drawer-story.helper";

import { DisablePersonalVaultExportPolicy } from "./disable-personal-vault-export.component";

export default {
  ...policyDrawerMeta(new DisablePersonalVaultExportPolicy()),
  title: "Admin Console/Organizations/Policies/Disable Personal Vault Export",
};

type Story = StoryObj<PolicyDrawerStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
