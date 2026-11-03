import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { I18nMockService } from "@bitwarden/components";

import { CopyCipherFieldService } from "../../services/copy-cipher-field.service";

import { VaultItemCopyActionsComponent } from "./item-copy-actions.component";

function card(fields: Partial<CipherView["card"]>): CipherView {
  const cipher = new CipherView();
  cipher.type = CipherType.Card;
  cipher.name = "Visa card";
  Object.assign(cipher.card, fields);
  return cipher;
}

const populatedCard = card({
  cardholderName: "Jane Doe",
  number: "4111111111111111",
  expMonth: "5",
  expYear: "2030",
  code: "123",
});

export default {
  title: "Vault/Item Copy Actions",
  component: VaultItemCopyActionsComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              copy: "Copy",
              copyCardholderName: "Copy cardholder name",
              copyNumber: "Copy number",
              copyExpiration: "Copy expiration date",
              copySecurityCode: "Copy security code",
              noCardholderName: "No cardholder name",
              noNumber: "No number",
              noExpiration: "No expiration date",
              noSecurityCode: "No security code",
              noDetailsToCopy: "No details to copy",
            }),
        },
        {
          provide: CopyCipherFieldService,
          useValue: {
            copy: async (value: string) => {
              await navigator.clipboard.writeText(value);
              return true;
            },
          } satisfies Partial<CopyCipherFieldService>,
        },
        { provide: AccountService, useValue: {} },
        { provide: CipherService, useValue: {} },
      ],
    }),
    componentWrapperDecorator(
      (story) => `<div class="tw-flex tw-justify-end tw-w-80 tw-p-4">${story}</div>`,
    ),
  ],
  args: { cipher: populatedCard },
} satisfies Meta<VaultItemCopyActionsComponent>;

type Story = StoryObj<VaultItemCopyActionsComponent>;

export const CardMenu: Story = {};

export const CardQuickCopy: Story = { args: { showQuickCopyActions: true } };

export const CardholderNameOnly: Story = {
  args: { cipher: card({ cardholderName: "Jane Doe" }) },
};

export const ExpirationOnly: Story = {
  args: { cipher: card({ expMonth: "5", expYear: "2030" }) },
};

export const EmptyCard: Story = { args: { cipher: card({}) } };
