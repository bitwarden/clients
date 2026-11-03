import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { DIALOG_DATA, DialogRef } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AUDIT_HISTORY_DAYS, auditRangeValue } from "../access-audit-row";

import {
  CustomRangeDialogComponent,
  CustomRangeDialogParams,
} from "./custom-range-dialog.component";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Relative to now, since the dialog judges the history window against the clock. */
function daysAgo(days: number): string {
  return auditRangeValue(new Date(Date.now() - days * DAY_MS));
}

/** Provided per story, since the dialog reads `DIALOG_DATA` once at construction. */
function withParams(params: CustomRangeDialogParams) {
  return moduleMetadata({
    imports: [CustomRangeDialogComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: params },
      { provide: DialogRef, useValue: { close: () => {} } },
    ],
  });
}

export default {
  title: "Web/PAM/Access Audit/Custom Range Dialog",
  component: CustomRangeDialogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  render: () => ({ template: `<pam-custom-range-dialog />` }),
} as Meta<CustomRangeDialogComponent>;

type Story = StoryObj<CustomRangeDialogComponent>;

/** Both bounds blank, so Save stays disabled. */
export const Empty: Story = {
  decorators: [withParams({ from: "", to: "" })],
};

export const Range: Story = {
  decorators: [withParams({ from: daysAgo(7), to: daysAgo(1) })],
};

/** A blank bound leaves that side open. */
export const FromOnly: Story = {
  decorators: [withParams({ from: daysAgo(14), to: "" })],
};

export const InvertedRange: Story = {
  decorators: [withParams({ from: daysAgo(1), to: daysAgo(7) })],
};

/** The server reads no further back than its history window. */
export const BeforeHistory: Story = {
  decorators: [withParams({ from: daysAgo(AUDIT_HISTORY_DAYS + 10), to: daysAgo(1) })],
};
