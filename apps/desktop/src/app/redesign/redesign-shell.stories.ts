import { applicationConfig } from "@storybook/angular";
import type { Meta, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";

import { KlsRedesignShellComponent } from "./redesign-shell.component";

const mockAccountService = { activeAccount$: of(null) };
const mockCipherService = { cipherViews$: () => of([]), getAllDecrypted: () => Promise.resolve([]) };
const mockTotpService = { getCode$: () => of({ code: "123456", period: 30 }) };

export default {
  title: "Fork Redesign/App Shell",
  component: KlsRedesignShellComponent,
  parameters: { layout: "fullscreen" },
  decorators: [
    applicationConfig({
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: CipherService, useValue: mockCipherService },
        { provide: TotpService, useValue: mockTotpService },
      ],
    }),
  ],
} as Meta<KlsRedesignShellComponent>;

type Story = StoryObj<KlsRedesignShellComponent>;

export const Default: Story = {};
