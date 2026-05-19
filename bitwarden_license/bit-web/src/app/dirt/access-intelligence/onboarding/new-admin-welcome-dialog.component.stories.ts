import { Router } from "@angular/router";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DIALOG_DATA,
  TypographyModule,
} from "@bitwarden/components";
import { VaultCarouselModule } from "@bitwarden/vault";

import { NewAdminWelcomeDialogComponent } from "./new-admin-welcome-dialog.component";
import { OnboardingService } from "./services/onboarding.service";

const mockDialogRef = { close: async () => {} };
const mockOnboardingService = { setCarouselAcknowledged: async () => {} };
const mockOrganizationId = "story-org-id" as OrganizationId;

export default {
  title: "Access Intelligence/NewAdminWelcomeDialog",
  component: NewAdminWelcomeDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [VaultCarouselModule, DialogModule, ButtonModule, TypographyModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: OnboardingService, useValue: mockOnboardingService },
        { provide: DIALOG_DATA, useValue: { organizationId: mockOrganizationId } },
        { provide: Router, useValue: { navigate: async () => {} } },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<NewAdminWelcomeDialogComponent>;

export const Default: Story = {};
