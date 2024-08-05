import { importProvidersFrom } from "@angular/core";
import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BadgeModule, IconModule } from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../core/tests";
import { PremiumBadgeComponent } from "../../../../vault/components/premium-badge.component";
import { ReportVariant } from "../models/report-variant";

import { ReportCardComponent } from "./report-card.component";

export default {
  title: "Web/Reports/Card",
  component: ReportCardComponent,
  decorators: [
    moduleMetadata({
      imports: [JslibModule, BadgeModule, IconModule, RouterTestingModule],
      declarations: [PremiumBadgeComponent],
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
