import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { DIALOG_DATA, DialogRef } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import {
  WithdrawApprovalDialogComponent,
  WithdrawApprovalDialogParams,
} from "./withdraw-approval-dialog.component";

const params: WithdrawApprovalDialogParams = {
  itemName: "Prod database",
  organizationName: "Meridian Group",
  collectionName: "Production",
  requesterName: "Grace Hopper",
};

/** Provided per story, since the dialog reads `DIALOG_DATA` once at construction. */
function withParams(data: WithdrawApprovalDialogParams) {
  return moduleMetadata({
    imports: [WithdrawApprovalDialogComponent],
    providers: [
      { provide: DialogRef, useValue: { close: () => {} } },
      { provide: DIALOG_DATA, useValue: data },
    ],
  });
}

export default {
  title: "Web/PAM/Withdraw Approval Dialog",
  component: WithdrawApprovalDialogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  render: () => ({ template: `<pam-withdraw-approval-dialog />` }),
} as Meta<WithdrawApprovalDialogComponent>;

type Story = StoryObj<WithdrawApprovalDialogComponent>;

/** Opens with confirm disabled, since withdrawing requires a reason. */
export const Default: Story = {
  decorators: [withParams(params)],
};

/** Names that did not resolve are dropped from the item card rather than left blank. */
export const NoOrganizationOrCollection: Story = {
  decorators: [withParams({ ...params, organizationName: null, collectionName: null })],
};
