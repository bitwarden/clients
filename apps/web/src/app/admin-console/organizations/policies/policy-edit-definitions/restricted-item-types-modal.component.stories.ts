import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyModalMeta } from "../policy-drawer-story.helper";

import { RestrictedItemTypesPolicy } from "./restricted-item-types.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2-only design change leaking into the modal. Compare against the
 * drawer stories in restricted-item-types.component.stories.ts.
 */
export default {
  ...policyModalMeta(new RestrictedItemTypesPolicy()),
  title: "Admin Console/Organizations/Policies/Restricted Item Types/Modal (flag off)",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
