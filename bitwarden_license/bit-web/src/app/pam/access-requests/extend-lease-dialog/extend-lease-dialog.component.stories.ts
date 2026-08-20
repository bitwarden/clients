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

/**
 * As opened: the duration picker is seeded with the first `EXTENSION_DURATION_OPTIONS` entry (30m)
 * and Extend is disabled, because the server rejects an extension whose `reason` is empty.
 */
export const Default: Story = {};

/** A justification typed in — the only thing standing between the pristine form and a valid one. */
export const Completed: Story = {
  play: async ({ canvasElement }) => {
    const reason = canvasElement.querySelector<HTMLTextAreaElement>(REASON_INPUT)!;
    await userEvent.type(reason, "Migration is still running and needs another hour.");
  },
};

/**
 * The reason left empty and blurred. Extend stays disabled rather than submitting and bouncing off
 * the server, so the required error is what the field surfaces on touch.
 */
export const ReasonRequired: Story = {
  play: async ({ canvasElement }) => {
    const reason = canvasElement.querySelector<HTMLTextAreaElement>(REASON_INPUT)!;
    await userEvent.click(reason);
    await userEvent.tab();
  },
};
