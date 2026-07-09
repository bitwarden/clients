import { StoryObj } from "@storybook/angular";

import {
  PolicyDialogStoryArgs,
  policyModalMeta,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-drawer-story.helper";

import { DisablePersonalVaultExportPolicy } from "./disable-personal-vault-export.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2 design change leaking into the modal. Compare against the drawer
 * stories in disable-personal-vault-export.component.stories.ts.
 */
export default {
  ...policyModalMeta(new DisablePersonalVaultExportPolicy()),
  title: "Admin Console/Organizations/Policies/Disable Personal Vault Export/Modal (flag off)",
};

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
