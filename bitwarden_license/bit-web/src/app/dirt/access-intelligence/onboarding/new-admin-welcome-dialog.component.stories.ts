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
  I18nMockService,
} from "@bitwarden/components";
import { VaultCarouselModule } from "@bitwarden/vault";

import { NewAdminWelcomeDialogComponent } from "./new-admin-welcome-dialog.component";
import { OnboardingService } from "./services/onboarding.service";

const mockDialogRef = { close: async () => {} };
const mockOnboardingService = {
  setPostImportDialogAcknowledged: async () => {},
  setNewAdminWelcomeDialogAcknowledged: async () => {},
};
const mockOrganizationId = "story-org-id" as OrganizationId;

const mockI18nService = new I18nMockService({
  accessIntelligenceWelcomeTour: "Welcome to Access Intelligence!",
  yourEntireOrgsSecurityInOneView: "Your entire org's security in one view",
  accessIntelligenceGivesYouSinglePlace:
    "Access Intelligence gives you a single place to view and manage your organization's security posture, so you can spend less time on security administration and more time on strategic initiatives.",
  youSetThePrioritiesWeSurfaceTheRisks: "You set the priorities, we surface the risks.",
  youMarkWhichAppsAreMostCritical:
    "You mark which apps are most critical to your org, and Access Intelligence surfaces the riskiest accounts and weakest links in those apps, so you can focus on what matters most.",
  trackImprovementsAcrossYourTeam: "Track improvements across your team.",
  membersAreAutomaticallyNotified:
    "Members are automatically notified of security risks and can take action to resolve them, making it easier than ever to maintain a strong security posture across your organization.",
  importYourOrgDataToGetStarted: "Import your org data to get started",
  onceItHasTheVaultData:
    "Once it has the vault data, Access Intelligence can start surfacing insights and recommendations to help you improve your organization's security.",
  skip: "Skip",
  back: "Back",
  next: "Next",
  importData: "Import Data",
});

export default {
  title: "Access Intelligence/NewAdminWelcomeDialog",
  component: NewAdminWelcomeDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [VaultCarouselModule, DialogModule, ButtonModule, TypographyModule],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
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
