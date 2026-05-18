import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, StoryObj } from "@storybook/angular";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { HumanApprovalEditorComponent } from "./human-approval-editor.component";

export default {
  title: "Web/PAM/Policy Editors/Human Approval",
  component: HumanApprovalEditorComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<HumanApprovalEditorComponent>;

type Story = StoryObj<HumanApprovalEditorComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <div class="tw-max-w-lg tw-p-4">
        <pam-human-approval-editor></pam-human-approval-editor>
      </div>
    `,
  }),
};

export const WithManageLinkHandler: Story = {
  render: (args) => ({
    props: {
      ...args,
      onManage: () => alert("Switch to Access tab"),
    },
    template: /* HTML */ `
      <div class="tw-max-w-lg tw-p-4">
        <pam-human-approval-editor
          (manageMembersClicked)="onManage()"
        ></pam-human-approval-editor>
      </div>
    `,
  }),
};
