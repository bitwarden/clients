import { importProvidersFrom } from "@angular/core";
import { Router } from "@angular/router";
import { applicationConfig, Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DIALOG_DATA,
  TypographyModule,
} from "@bitwarden/components";
import { VaultCarouselModule } from "@bitwarden/vault";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { NewAdminWelcomeDialogComponent } from "./new-admin-welcome-dialog.component";
import { OnboardingService } from "./services/onboarding.service";

const mockDialogRef = { close: async () => {} };
const mockOnboardingService = {
  setPostImportDialogAcknowledged: async () => {},
  setNewAdminWelcomeDialogAcknowledged: async () => {},
};
const mockOrganizationId = "story-org-id" as OrganizationId;

export default {
  title: "DIRT/Access Intelligence/New Admin Welcome Dialog",
  component: NewAdminWelcomeDialogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
    moduleMetadata({
      imports: [VaultCarouselModule, DialogModule, ButtonModule, TypographyModule],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: OnboardingService, useValue: mockOnboardingService },
        { provide: DIALOG_DATA, useValue: { organizationId: mockOrganizationId } },
        { provide: Router, useValue: { navigate: async () => {} } },
      ],
    }),
  ],
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
} as Meta;

type Story = StoryObj<NewAdminWelcomeDialogComponent>;

export const Default: Story = {};
