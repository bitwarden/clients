import { importProvidersFrom } from "@angular/core";
import { RouterTestingModule } from "@angular/router/testing";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import {
  BadgeModule,
  BaseCardComponent,
  CardContentComponent,
  IconModule,
} from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../core/tests";
import { reports } from "../../reports";
import { ReportVariant } from "../models/report-variant";
import { ReportCardComponent } from "../report-card/report-card.component";

import { ReportListComponent } from "./report-list.component";

export default {
  title: "Web/Reports/List",
  component: ReportListComponent,
  decorators: [
    moduleMetadata({
      imports: [
        JslibModule,
        BadgeModule,
        RouterTestingModule,
        IconModule,
        PremiumBadgeComponent,
        CardContentComponent,
        BaseCardComponent,
      ],
      declarations: [ReportCardComponent],
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
    reports: Object.values(reports).map((report) => ({
      ...report,
      variant:
        report.route == "breach-report" ? ReportVariant.Enabled : ReportVariant.RequiresPremium,
    })),
  },
} as Meta;

type Story = StoryObj<ReportListComponent>;

export const Default: Story = {};
