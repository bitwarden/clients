import { BitwardenIcon } from "@bitwarden/components";

/** The starter templates offered on the empty state. Each key maps to a card + a create-form prefill. */
export type AccessRuleTemplateKey = "just-in-time" | "approval-required" | "ip-restricted";

export type AccessRuleTemplate = {
  key: AccessRuleTemplateKey;
  /** Empty-state card presentation. */
  icon: BitwardenIcon;
  titleKey: string;
  summaryKey: string;
  /** Values seeded into a new rule when this template is chosen. */
  prefill: {
    nameKey: string;
    defaultLeaseDurationSeconds: number;
    humanApprovalEnabled: boolean;
    ipAllowlistEnabled: boolean;
  };
};

/**
 * Single source of truth for the starter templates. The empty state renders these as cards;
 * picking one navigates to the create page with the template key, and the edit page applies the
 * matching {@link AccessRuleTemplate.prefill}.
 */
export const ACCESS_RULE_TEMPLATES: AccessRuleTemplate[] = [
  {
    key: "just-in-time",
    icon: "bwi-clock",
    titleKey: "pamTemplateJustInTimeTitle",
    summaryKey: "pamTemplateJustInTimeSummary",
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
    summaryKey: "pamTemplateApprovalRequiredSummary",
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
    summaryKey: "pamTemplateIpRestrictedSummary",
    prefill: {
      nameKey: "pamTemplateIpRestrictedName",
      defaultLeaseDurationSeconds: 60 * 60,
      humanApprovalEnabled: false,
      ipAllowlistEnabled: true,
    },
  },
];
