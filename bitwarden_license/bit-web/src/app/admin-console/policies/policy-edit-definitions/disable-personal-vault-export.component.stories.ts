import { StoryObj } from "@storybook/angular";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { enabledFlags } from "@bitwarden/storybook";
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

/**
 * The drawer with the VFO1 terminology flag on — the description renders "vault data"
 * terminology per Figma.
 */
export const PolicyOnVfo1Enabled: Story = {
  args: { enabled: true },
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
};
