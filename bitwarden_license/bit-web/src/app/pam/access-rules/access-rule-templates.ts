import { BitwardenIcon } from "@bitwarden/components";

export type AccessRuleTemplateKey = "just-in-time" | "approval-required" | "ip-restricted";

export type AccessRuleTemplate = {
  key: AccessRuleTemplateKey;
  icon: BitwardenIcon;
  titleKey: string;
  summaryKey: string;
  prefill: {
    nameKey: string;
    defaultLeaseDurationSeconds: number;
    humanApprovalEnabled: boolean;
    ipAllowlistEnabled: boolean;
  };
};

/** Picking one opens the create page with its key, and that page applies the matching prefill. */
export const ACCESS_RULE_TEMPLATES: AccessRuleTemplate[] = [
  {
    key: "just-in-time",
    icon: "bwi-clock",
    titleKey: "pamTemplateJustInTimeTitle",
    summaryKey: "pamTemplateJustInTimeShortSummary",
    prefill: {
      nameKey: "pamTemplateJustInTimeName",
      defaultLeaseDurationSeconds: 60 * 60,
      humanApprovalEnabled: false,
      ipAllowlistEnabled: false,
    },
  },
  {
    key: "approval-required",
    icon: "bwi-check-circle",
    titleKey: "pamTemplateApprovalRequiredTitle",
    summaryKey: "pamTemplateApprovalRequiredShortSummary",
    prefill: {
      nameKey: "pamTemplateApprovalRequiredName",
      defaultLeaseDurationSeconds: 60 * 60,
      humanApprovalEnabled: true,
      ipAllowlistEnabled: false,
    },
  },
  {
    key: "ip-restricted",
    icon: "bwi-wireless",
    titleKey: "pamTemplateIpRestrictedTitle",
    summaryKey: "pamTemplateIpRestrictedShortSummary",
    prefill: {
      nameKey: "pamTemplateIpRestrictedName",
      defaultLeaseDurationSeconds: 60 * 60,
      humanApprovalEnabled: false,
      ipAllowlistEnabled: true,
    },
  },
];
