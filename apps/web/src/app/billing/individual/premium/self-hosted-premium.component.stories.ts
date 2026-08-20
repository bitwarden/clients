import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { Vfo1TerminologyService } from "@bitwarden/vault";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { SelfHostedPremiumComponent } from "./self-hosted-premium.component";

const mockAccountService = {
  activeAccount$: of({ id: "user-1", email: "user@example.com" }),
};

const mockBillingAccountProfileStateService = {
  hasPremiumFromAnyOrganization$: () => of(false),
  hasPremiumPersonally$: () => of(false),
};

const mockEnvironmentService = {
  cloudWebVaultUrl$: of("https://vault.bitwarden.com"),
};

const mockDialogService: Partial<DialogService> = {};
const mockToastService = { showToast: () => {} };
const mockRouter = { navigate: () => Promise.resolve(true) };
const mockConfigService = { getFeatureFlag$: () => of(false) } as unknown as ConfigService;

export default {
  title: "Billing/Individual/Self-Hosted Premium",
  component: SelfHostedPremiumComponent,
  decorators: [
    moduleMetadata({
      providers: [
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: mockRouter },
        { provide: AccountService, useValue: mockAccountService },
        {
          provide: BillingAccountProfileStateService,
          useValue: mockBillingAccountProfileStateService,
        },
        { provide: EnvironmentService, useValue: mockEnvironmentService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<SelfHostedPremiumComponent>;

type Story = StoryObj<SelfHostedPremiumComponent>;

/** Self-hosted upgrade page — Premium and Families cards, including the Families feature list. */
export const Default: Story = {};

/**
 * With the VFO1 terminology flag on — the Families card's "Unlimited family collections"
 * feature renders as "Unlimited family shared folders".
 */
export const Vfo1Enabled: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: Vfo1TerminologyService,
          useValue: { enabled: () => true, iconClass: (icon: string) => icon },
        },
      ],
    }),
  ],
};
