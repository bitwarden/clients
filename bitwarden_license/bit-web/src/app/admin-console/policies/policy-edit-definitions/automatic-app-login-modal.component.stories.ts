import { Meta, StoryObj } from "@storybook/angular";

import {
  PolicyDialogStoryArgs,
  policyModalMeta,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-drawer-story.helper";

import { AutomaticAppLoginPolicy } from "./automatic-app-login.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2 design change leaking into the modal. Compare against the drawer
 * stories in automatic-app-login.component.stories.ts.
 */
export default {
  ...policyModalMeta(new AutomaticAppLoginPolicy()),
  title: "Admin Console/Organizations/Policies/Automatic App Login/Modal (flag off)",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
