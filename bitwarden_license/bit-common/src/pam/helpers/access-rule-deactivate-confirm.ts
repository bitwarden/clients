import { SimpleDialogOptions } from "@bitwarden/components";

/**
 * Confirmation copy for deactivating access rules — a speedbump, not a warning about loss:
 * deactivating only stops a rule governing *new* requests, so the dialog says what stops, not
 * what breaks (access already in flight runs to its natural end).
 *
 * `count` is how many rules will actually change — the row menu passes 1, the bulk bar passes
 * its selection minus already-inactive rules. One rule gets the singular copy regardless of
 * surface; the plural takes over from 2, branched here since the i18n layer has no plural
 * support.
 *
 * Activation gets no confirmation, since turning a rule back on only ever adds gating.
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
