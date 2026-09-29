import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { ButtonModule, DialogModule, DialogRef, DIALOG_DATA } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessIntelligenceCoachmarkService } from "./access-intelligence-coachmark.service";
import { PostImportModalDialogComponent } from "./post-import-modal-dialog.component";
import { OnboardingService } from "./services/onboarding.service";

const mockOrganizationId = "story-org-id" as OrganizationId;

export default {
  title: "DIRT/Access Intelligence/Post Import Modal Dialog",
  component: PostImportModalDialogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
    moduleMetadata({
      imports: [DialogModule, ButtonModule],
      providers: [
        { provide: DialogRef, useValue: { close: async () => {} } },
        { provide: DIALOG_DATA, useValue: { organizationId: mockOrganizationId } },
        {
          provide: OnboardingService,
          useValue: { setPostImportDialogAcknowledged: async () => {} },
        },
        { provide: AccessIntelligenceCoachmarkService, useValue: { startTour: async () => {} } },
        { provide: LogService, useValue: { error: () => {}, info: () => {} } },
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

type Story = StoryObj<PostImportModalDialogComponent>;

export const Default: Story = {};
