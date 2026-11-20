import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { DialogRef } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { PamWelcomeDialogComponent } from "./pam-welcome-dialog.component";

/** The dialog resolves through `DialogRef`; nothing here needs to observe the result. */
const dialogRef = { close: () => {} };

export default {
  title: "Web/PAM/Welcome Dialog",
  component: PamWelcomeDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [PamWelcomeDialogComponent],
      providers: [{ provide: DialogRef, useValue: dialogRef }],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  render: () => ({ template: `<pam-welcome-dialog />` }),
} as Meta<PamWelcomeDialogComponent>;

type Story = StoryObj<PamWelcomeDialogComponent>;

/** As opened for a newly licensed member. */
export const Default: Story = {};

/**
 * Stress test for translated copy: the description is replaced with a much longer one to check
 * that it wraps instead of clipping.
 */
export const LongText: Story = {
  play: async ({ canvasElement }) => {
    const longText =
      "Ein sehr langer übersetzter Text, der in mehreren Zeilen umbrochen werden muss, ohne abgeschnitten zu werden.";
    const node = canvasElement.querySelector<HTMLElement>("#pam-welcome-dialog_description");
    if (node) {
      node.textContent = `${node.textContent} ${longText}`;
    }
  },
};
