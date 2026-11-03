import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { VaultRowAccessIconComponent } from "./vault-row-access-icon.component";
import { VAULT_ROW_ACCESS, VaultRowAccessStatus } from "./vault-row-access.token";
import { VaultRowSubtitleComponent } from "./vault-row-subtitle.component";

type RowArgs = { name: string; status: VaultRowAccessStatus; username?: string };

function cipher(name: string): CipherView {
  const view = new CipherView();
  view.id = "cipher-1";
  view.name = name;
  view.partial = true;
  return view;
}

/** The name-line icon and subtitle of a privileged-control row, one story per Figma state. */
export default {
  title: "Browser/Vault/Row access status",
  decorators: [
    moduleMetadata({ imports: [VaultRowAccessIconComponent, VaultRowSubtitleComponent] }),
  ],
  render: (args: RowArgs) => ({
    props: { cipher: cipher(args.name) },
    moduleMetadata: {
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: RevealedCipherService,
          useValue: {
            revealed$: () =>
              of(
                args.username == null
                  ? new Map()
                  : new Map([["cipher-1" as CipherId, { subTitle: args.username } as CipherView]]),
              ),
          },
        },
        { provide: VAULT_ROW_ACCESS, useValue: { status$: () => of(args.status) } },
      ],
    },
    template: `
      <div class="tw-w-72 tw-p-2">
        <div class="tw-flex tw-items-center tw-gap-1.5">
          <span>${args.name}</span>
          <app-vault-row-access-icon [cipher]="cipher"></app-vault-row-access-icon>
        </div>
        <div class="tw-text-muted tw-text-xs">
          <app-vault-row-subtitle [cipher]="cipher"></app-vault-row-subtitle>
        </div>
      </div>
    `,
  }),
} as Meta<RowArgs>;

type Story = StoryObj<RowArgs>;

export const Request: Story = {
  args: { name: "Amazon", status: { kind: "request", label: "Request to use", canExtend: false } },
};

export const Pending: Story = {
  args: {
    name: "Discord",
    status: { kind: "pending", label: "Pending approval", canExtend: false },
  },
};

export const Unavailable: Story = {
  args: {
    name: "Microsoft",
    status: { kind: "unavailable", label: "Unavailable to request", canExtend: false },
  },
};

export const Ready: Story = {
  args: { name: "Okta", status: { kind: "ready", label: "Ready to use", canExtend: false } },
};

export const InUse: Story = {
  args: {
    name: "Company Facebook",
    username: "frodo@shire.com",
    status: { kind: "active", label: "8h left", canExtend: true },
  },
};
