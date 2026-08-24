import { Meta, moduleMetadata, StoryObj, applicationConfig } from "@storybook/angular";

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
    moduleMetadata({
      imports: [DecryptionFailureDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close: () => {} } },
        { provide: PlatformUtilsService, useValue: { copyToClipboard: () => {} } },
        { provide: ToastService, useValue: { showToast: () => {} } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              decryptionError: "Decryption error",
              couldNotDecryptVaultItem:
                "Bitwarden could not decrypt the vault item listed below. Contact the Bitwarden support team and provide the item ID below to see if it can be recovered.",
              couldNotDecryptVaultItems:
                "Bitwarden could not decrypt the vault items listed below. Contact the Bitwarden support team and provide the item IDs below to see if they can be recovered.",
              itemId: "Item ID",
              itemIds: "Item IDs",
              copyId: "Copy ID",
              copyAllIds: "Copy all IDs",
              close: "Close",
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
