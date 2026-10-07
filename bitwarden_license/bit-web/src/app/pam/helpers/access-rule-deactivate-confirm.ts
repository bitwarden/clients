import { SimpleDialogOptions } from "@bitwarden/components";

/**
 * `count` is how many rules will change, so bulk callers exclude already-inactive ones. Plurals
 * branch here, since the i18n layer has no plural support. Activation needs no confirm, as it only
 * adds gating.
 */
export function accessRuleDeactivateConfirmOptions(count = 1): SimpleDialogOptions {
  const many = count > 1;
  return {
    title: {
      key: many ? "pamAccessRuleBulkDeactivateConfirmTitle" : "pamAccessRuleDeactivateConfirmTitle",
    },
    content: many
      ? { key: "pamAccessRuleBulkDeactivateConfirmContent", placeholders: [count.toString()] }
      : { key: "pamAccessRuleDeactivateConfirmContent" },
    acceptButtonText: { key: many ? "pamAccessRuleBulkDeactivate" : "pamAccessRuleDeactivate" },
    cancelButtonText: { key: "cancel" },
    type: "warning",
  };
}
