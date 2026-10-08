import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { userEvent } from "storybook/test";

import { DialogRef } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ExtendLeaseDialogComponent } from "./extend-lease-dialog.component";

/** The dialog resolves through `DialogRef`; nothing here needs to observe the result. */
const dialogRef = { close: () => {} };

const REASON_INPUT = "#extend-lease-dialog_textarea_reason";

export default {
  title: "Web/PAM/Extend Lease Dialog",
  component: ExtendLeaseDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [ExtendLeaseDialogComponent],
      providers: [{ provide: DialogRef, useValue: dialogRef }],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  render: () => ({ template: `<pam-extend-lease-dialog />` }),
} as Meta<ExtendLeaseDialogComponent>;

type Story = StoryObj<ExtendLeaseDialogComponent>;

/** As opened, with Extend disabled until a reason is entered. */
export const Default: Story = {};

/** A reason typed in, which is all a valid form needs. */
export const Completed: Story = {
  play: async ({ canvasElement }) => {
    const reason = canvasElement.querySelector<HTMLTextAreaElement>(REASON_INPUT)!;
    await userEvent.type(reason, "Migration is still running and needs another hour.");
  },
};

/** The reason left empty and blurred, which surfaces the required error. */
export const ReasonRequired: Story = {
  play: async ({ canvasElement }) => {
    const reason = canvasElement.querySelector<HTMLTextAreaElement>(REASON_INPUT)!;
    await userEvent.click(reason);
    await userEvent.tab();
  },
};
