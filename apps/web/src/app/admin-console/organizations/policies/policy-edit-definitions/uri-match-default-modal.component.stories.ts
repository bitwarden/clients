import { Meta, StoryObj } from "@storybook/angular";

import { PolicyDialogStoryArgs, policyModalMeta } from "../policy-drawer-story.helper";

import { UriMatchDefaultPolicy } from "./uri-match-default.component";

/**
 * Renders the PolicyDrawers-flag-off (modal) experience for this policy, so a visual diff (e.g.
 * via Chromatic) catches any v2-only design change leaking into the modal. Compare against the
 * drawer stories in uri-match-default.component.stories.ts.
 */
export default {
  ...policyModalMeta(new UriMatchDefaultPolicy()),
  title: "Admin Console/Organizations/Policies/Default URI Match Detection/Modal (flag off)",
} satisfies Meta<PolicyDialogStoryArgs>;

type Story = StoryObj<PolicyDialogStoryArgs>;

export const PolicyOff: Story = {};

export const PolicyOn: Story = {
  args: { enabled: true },
};
