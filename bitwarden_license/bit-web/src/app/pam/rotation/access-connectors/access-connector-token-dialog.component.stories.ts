import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

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
      { provide: DialogRef, useValue: { close: () => {} } },
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

export const Default: Story = {
  decorators: [withParams({ accessConnectorName: "eu-west-rotator", token: TOKEN })],
};

export const LongName: Story = {
  decorators: [
    withParams({
      accessConnectorName:
        "Primary datacenter rotation connector for the production directory and its replicas",
      token: TOKEN,
    }),
  ],
};
