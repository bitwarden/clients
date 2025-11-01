import { importProvidersFrom } from "@angular/core";
import { RouterTestingModule } from "@angular/router/testing";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import {
  BadgeModule,
  BaseCardComponent,
  CardContentComponent,
  I18nMockService,
  IconModule,
} from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../core/tests";
import { ReportVariant } from "../models/report-variant";

import { ReportCardComponent } from "./report-card.component";

export default {
  title: "Web/Reports/Card",
  component: ReportCardComponent,
  decorators: [
    moduleMetadata({
      imports: [
        JslibModule,
        BadgeModule,
        CardContentComponent,
        IconModule,
        RouterTestingModule,
        PremiumBadgeComponent,
        BaseCardComponent,
      ],
      providers: [
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: "123",
            }),
          },
        },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              premium: "Premium",
              upgrade: "Upgrade",
            });
          },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: {
            hasPremiumFromAnySource$: () => of(false),
          },
        },
        {
          provide: PremiumUpgradePromptService,
          useValue: {
            promptForPremium: (orgId?: string) => {},
          },
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  args: {
    title: "Exposed Passwords",
    description:
      "Passwords exposed in a data breach are easy targets for attackers. Change these passwords to prevent potential break-ins.",
    icon: "reportExposedPasswords",
    variant: ReportVariant.Enabled,
  },
} as Meta;

type Story = StoryObj<ReportCardComponent>;

export const Enabled: Story = {};

export const RequiresPremium: Story = {
  args: {
    variant: ReportVariant.RequiresPremium,
  },
};

export const RequiresUpgrade: Story = {
  args: {
    variant: ReportVariant.RequiresUpgrade,
  },
};
