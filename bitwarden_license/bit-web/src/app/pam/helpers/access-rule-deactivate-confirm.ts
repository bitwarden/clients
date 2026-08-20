import { SimpleDialogOptions } from "@bitwarden/components";

/**
 * Confirmation copy for deactivating access rules — a speedbump, not a warning about loss:
 * deactivating only stops a rule governing *new* requests. Access already in flight is untouched
 * (leases run to their natural expiry, approved requests stay startable, and pending requests are
 * still decided against the rule pinned to them at submit), so the dialog says what stops rather
 * than what breaks.
 *
 * `count` is how many rules will actually change — the row menu passes 1, and the bulk bar passes
 * its selection minus the rules already inactive, so the number the admin confirms is the number
 * that moves. One rule gets the singular copy whichever surface asked, which is both the only
 * grammatical option and the wording design signed off; the plural copy takes over from 2.
 * Branching here rather than at the call site is how the rest of the app pluralises (see
 * `access-rule-collection-badges.component`) — the i18n layer has no plural support.
 *
 * Activation gets no confirmation — turning a rule back on only ever adds gating, and
 * reactivation has its own ticket.
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
