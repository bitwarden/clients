import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { DIALOG_DATA, DialogRef } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { accessRuleDeleteConfirmParams } from "../helpers/access-rule-delete-confirm";

import { PamConfirmDialogComponent, PamConfirmDialogParams } from "./pam-confirm-dialog.component";

/**
 * The dialog reads `DIALOG_DATA` once at construction and exposes no inputs, so each story has
 * to supply its own provider rather than driving the arrangement from args.
 */
function withParams(params: PamConfirmDialogParams) {
  return moduleMetadata({
    imports: [PamConfirmDialogComponent],
    providers: [
      { provide: DialogRef, useValue: { close: () => {} } },
      { provide: DIALOG_DATA, useValue: params },
    ],
  });
}

export default {
  title: "Web/PAM/Confirm Dialog",
  component: PamConfirmDialogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  render: () => ({ template: `<pam-confirm-dialog />` }),
} as Meta<PamConfirmDialogComponent>;

type Story = StoryObj<PamConfirmDialogComponent>;

/**
 * The arrangement this component exists for, rendered from the same `accessRuleDeleteConfirmParams`
 * the list and the edit page pass: a danger glyph above a primary accept button, which
 * `openSimpleDialog` cannot produce because it locks the glyph's colour and the button's variant
 * together.
 */
export const DeleteRule: Story = {
  decorators: [withParams(accessRuleDeleteConfirmParams("Prod database"))],
};

/**
 * The same copy with the accept button switched to `danger`, which is what `openSimpleDialog`
 * would have given us. Kept beside `DeleteRule` so the pairing the design asked for stays legible
 * as a choice rather than an accident.
 */
export const DangerAcceptButton: Story = {
  decorators: [
    withParams({ ...accessRuleDeleteConfirmParams("Prod database"), acceptButtonType: "danger" }),
  ],
};
