import { applicationConfig } from "@storybook/angular";
import type { Meta, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength/password-strength.service.abstraction";
import { LockService } from "@bitwarden/auth/common";

import { KlsRedesignShellComponent } from "./redesign-shell.component";

const mockAccountService = { activeAccount$: of(null) };
const mockCipherService = {
  cipherViews$: () => of([]),
  getAllDecrypted: () => Promise.resolve([]),
  updateWithServer: () => Promise.resolve({}),
};
const mockTotpService = { getCode$: () => of({ code: "123456", period: 30 }) };
const mockPlatformUtils = {
  copyToClipboard: () => {},
  readFromClipboard: () => Promise.resolve(""),
};
const mockPasswordStrength = {
  getPasswordStrength: () => ({ score: 3 }),
};
const mockLockService = { lock: () => Promise.resolve(), lockAll: () => Promise.resolve() };

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
        { provide: PlatformUtilsService, useValue: mockPlatformUtils },
        { provide: PasswordStrengthServiceAbstraction, useValue: mockPasswordStrength },
        { provide: LockService, useValue: mockLockService },
      ],
    }),
  ],
} as Meta<KlsRedesignShellComponent>;

type Story = StoryObj<KlsRedesignShellComponent>;

export const Default: Story = {};
