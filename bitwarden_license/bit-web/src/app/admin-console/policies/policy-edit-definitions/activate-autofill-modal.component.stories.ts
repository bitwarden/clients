import { Meta, StoryObj } from "@storybook/angular";

import {
  PolicyDialogStoryArgs,
  policyModalMeta,
} from "@bitwarden/web-vault/app/admin-console/organizations/policies/policy-drawer-story.helper";

import { ActivateAutofillPolicy } from "./activate-autofill.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2 design change leaking into the modal. Compare against the drawer
 * stories in activate-autofill.component.stories.ts.
 */
export default {
  ...policyModalMeta(
    "Admin Console/Organizations/Policies/Activate Autofill/Modal (flag off)",
    new ActivateAutofillPolicy(),
  ),
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
