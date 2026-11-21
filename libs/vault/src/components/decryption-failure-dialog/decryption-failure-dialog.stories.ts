import { provideRouter } from "@angular/router";
import { Meta, moduleMetadata, StoryObj, applicationConfig } from "@storybook/angular";
import { of } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, I18nMockService, ToastService } from "@bitwarden/components";

import { DecryptionFailureDialogComponent } from "./decryption-failure-dialog.component";

/** Stable, obviously-fake ids so the story renders identically on every run. */
const sampleIds = (count: number): CipherId[] =>
  Array.from(
    { length: count },
    (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` as CipherId,
  );

/**
 * Which dialog shell renders is driven by the real viewport width (the `md` breakpoint), so resize
 * the Storybook canvas below 768px to review the extension/narrow-web presentation.
 */
const storyFor = (count: number): StoryObj<DecryptionFailureDialogComponent> => ({
  decorators: [
    applicationConfig({
      providers: [{ provide: DIALOG_DATA, useValue: { cipherIds: sampleIds(count) } }],
    }),
  ],
  render: (args) => ({
    props: args,
    template: `<vault-decryption-failure-dialog></vault-decryption-failure-dialog>`,
  }),
});

export default {
  title: "Vault/Decryption Failure Dialog",
  component: DecryptionFailureDialogComponent,
  decorators: [
    applicationConfig({ providers: [provideRouter([])] }),
    moduleMetadata({
      imports: [DecryptionFailureDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close: () => {} } },
        {
          provide: PlatformUtilsService,
          useValue: {
            copyToClipboard: () => {},
            launchUri: () => {},
            getClientType: () => ClientType.Browser,
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            environment$: of({ getWebVaultUrl: () => "https://vault.bitwarden.com" }),
          },
        },
        { provide: ToastService, useValue: { showToast: () => {} } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              decryptionError: "Decryption error",
              couldNotDecryptVaultItemUseDataRecovery:
                "Bitwarden could not decrypt the vault item listed below. Go to the data recovery tool to diagnose the issue and save logs to share with Bitwarden support.",
              couldNotDecryptVaultItemsUseDataRecovery:
                "Bitwarden could not decrypt the vault items listed below. Go to the data recovery tool to diagnose the issue and save logs to share with Bitwarden support.",
              itemId: "Item ID",
              itemIds: "Item IDs",
              copyId: "Copy ID",
              copyAllIds: "Copy all IDs",
              close: "Close",
              goToDataRecoveryTool: "Go to data recovery tool",
            }),
        },
      ],
    }),
  ],
} as Meta;

export const SingleItem = storyFor(1);

export const MultipleItems = storyFor(3);

/** Exactly fills the field — no scrolling, no clipped row. */
export const SixItems = storyFor(6);

/** The 7th row must be partially cut off to signal that the field scrolls. */
export const SevenItems = storyFor(7);

export const ManyItems = storyFor(25);
