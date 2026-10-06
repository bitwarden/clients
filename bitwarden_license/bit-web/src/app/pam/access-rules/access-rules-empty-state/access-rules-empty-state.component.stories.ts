import { RouterModule } from "@angular/router";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { AccessRulesEmptyStateComponent } from "./access-rules-empty-state.component";

export default {
  title: "Web/PAM/Access Rules Empty State",
  component: AccessRulesEmptyStateComponent,
  decorators: [
    moduleMetadata({
      imports: [RouterModule.forRoot([])],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              pamNoAccessRulesYetTitle: "No access rules yet",
              pamNoAccessRulesYetDescription:
                "Create a rule to add extra protection to sensitive collections.",
              pamAccessRuleCreateCustom: "Create custom rule",
              pamAccessRulesStartFromTemplate: "Start from a template",
              pamAccessRuleUseTemplate: "Use template",
              pamTemplateJustInTimeTitle: "Just in time",
              pamTemplateJustInTimeSummary: "Auto-approved • Expires after 1h • Audit logged",
              pamTemplateApprovalRequiredTitle: "Approval required",
              pamTemplateApprovalRequiredSummary:
                "Human approval • 1 approver required • Audit logged",
              pamTemplateIpRestrictedTitle: "IP-restricted",
              pamTemplateIpRestrictedSummary: "Auto-approved • IP Allowlist • Audit logged",
              pamAccessRulesAuditFootnoteStart: "Every rule change and access event is recorded in",
              pamEventLogs: "Event Logs",
              pamAccessRulesAuditFootnoteEnd: "and exportable.",
            }),
        },
      ],
    }),
  ],
} as Meta<AccessRulesEmptyStateComponent>;

type Story = StoryObj<AccessRulesEmptyStateComponent>;

export const Default: Story = {};
