import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { userEvent } from "storybook/test";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import {
  AccessConnectorTokenDialogComponent,
  AccessConnectorTokenDialogParams,
} from "./access-connector-token-dialog.component";

/** Shaped like a real token, but not one. */
const TOKEN =
  "0.access-connector.00000000-0000-0000-0000-000000000000.not-a-real-client-secret:" +
  "bm90LXJlYWwta2V5LW1hdGVyaWFsLWZvci1zdG9yeWJvb2stb25seQ==";

/** Provided per story, since the dialog reads `DIALOG_DATA` once at construction. */
function withParams(params: AccessConnectorTokenDialogParams) {
  return moduleMetadata({
    imports: [AccessConnectorTokenDialogComponent],
    providers: [
      { provide: DIALOG_DATA, useValue: params },
      // Opened with disableClose, which hides the header's close button.
      { provide: DialogRef, useValue: { close: () => {}, disableClose: true } },
      { provide: PlatformUtilsService, useValue: { copyToClipboard: () => {} } },
      { provide: ToastService, useValue: { showToast: () => {} } },
    ],
  });
}

export default {
  title: "Web/PAM/Rotation/Access Connector Token Dialog",
  component: AccessConnectorTokenDialogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  render: () => ({ template: `<app-access-connector-token-dialog />` }),
} as Meta<AccessConnectorTokenDialogComponent>;

type Story = StoryObj<AccessConnectorTokenDialogComponent>;

/** Figma 1092:44630: the token just issued, Close disabled until the box is checked. */
export const Default: Story = {
  decorators: [withParams({ token: TOKEN })],
};

/** Figma 1092:44688: the admin confirmed they stored the token, so Close is enabled. */
export const Stored: Story = {
  decorators: [withParams({ token: TOKEN })],
  play: async ({ canvasElement }) => {
    await userEvent.click(
      canvasElement.querySelector<HTMLInputElement>(
        "#access-connector-token-dialog_checkbox_stored",
      )!,
    );
  },
};
