import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

/**
 * Creates I18n mock provider with all Access Intelligence translation keys
 */
export function createI18nMockProvider() {
  return {
    provide: I18nService,
    useFactory: () => {
      return new I18nMockService({
        // Common
        application: "Application",
        atRiskPasswords: "At-Risk Passwords",
        totalPasswords: "Total Passwords",
        atRiskMembers: "At-Risk Members",
        totalMembers: "Total Members",
        email: "Email",
        download: "Download",

        // Table headers
        selectAll: "Select all",
        deselectAll: "Deselect all",
        select: "Select",

        // Drawer titles
        atRiskMembersForApp: "At-Risk Members for {{app}}",
        criticalAtRiskMembers: "Critical Applications - At-Risk Members",
        atRiskApplications: "At-Risk Applications",
        criticalAtRiskApplications: "Critical Applications - At Risk",

        // Search
        searchApps: "Search applications",

        // Selection actions
        selectApplication: "Select application",
        unselectApplication: "Unselect application",
        unselectAll: "Unselect all",

        // Empty states
        noMembersFound: "No at-risk members found",
        noApplicationsFound: "No at-risk applications found",

        // Badge
        criticalBadge: "Critical",
      });
    },
  };
}
