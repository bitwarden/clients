import AutofillField from "../../models/autofill-field";
import { PageQualification } from "../../qualification/abstractions/qualification-engine";
import { FieldRole } from "../../qualification/types/field-role";

/**
 * Field selection for fill time, driven by a {@link PageQualification} instead
 * of keyword tables.
 *
 * Fill time picks one field per slot of the cipher it is filling —
 * `generateCardFillScript` builds a `fillFields` record keyed by card property,
 * then hands each entry to `makeScriptAction`. Only the *picking* lives here.
 * Everything downstream — the script actions, the expiry-format inference, the
 * select-option matching — is unchanged and unaware of which engine chose the
 * fields.
 *
 * This is the third qualification layer to route through the engine, after the
 * inline menu and the diagnostic triage report. Before it, switching engines
 * changed which fields showed a menu but not what a click actually filled.
 */

/**
 * The card slots fill time can fill, in the order a field gets to claim one.
 *
 * Order is load-bearing and preserved from the keyword implementation: a field
 * claims the first unclaimed slot it qualifies for, and each field claims at
 * most one. A page whose single input matches both `cardExpirationDate` and
 * `cardExpirationMonth` fills the combined date, as it always has.
 *
 * `brand` is the slot no boolean predicate ever exposed — see
 * {@link FieldRole.CardBrand}.
 */
const CARD_SLOTS: ReadonlyArray<readonly [key: string, role: FieldRole]> = Object.freeze([
  ["cardholderName", FieldRole.CardholderName],
  ["number", FieldRole.CardNumber],
  ["exp", FieldRole.CardExpirationDate],
  ["expMonth", FieldRole.CardExpirationMonth],
  ["expYear", FieldRole.CardExpirationYear],
  ["code", FieldRole.CardCvv],
  ["brand", FieldRole.CardBrand],
] as const);

/**
 * The score a field's classification must reach before fill will write a card
 * number, a CVV, or an expiry into it.
 *
 * This is fill's own bar, and it is deliberately not the engine's. The engine
 * admits a role into `matchedRoles` at anything above the `none` band, a floor
 * tuned for the inline menu — where a false positive shows a dropdown on the
 * wrong input, the user sees it, and no data moves. Here a false positive puts
 * a card number into an input the page can read, and there is no taking it
 * back. Below the floor the slot is left unclaimed and the cipher's value is
 * simply not filled; it is never filled somewhere else.
 *
 * **Why a raw score and not a {@link ConfidenceBand}.** The bands threshold
 * absolute posterior mass, and how much mass a correct answer can reach depends
 * on how much the page gave the engine to work with. A CVV labelled
 * `autocomplete="cc-csc"` clears `high` easily; the same unambiguous CVV on a
 * form with no `autocomplete` attributes scores 0.527, under the 0.55 cutoff
 * (pinned in `parity/card-fill.parity.spec.ts`). A band therefore reports
 * partly how much evidence the page offered, not only how sure the engine is,
 * so no cutoff separates true from false positives on both form types — and
 * since `matchedRoles` already requires better than `none`, a band floor here
 * is either a no-op or a fill regression.
 *
 * Banding the margin over the runner-up role would fix that: missing evidence
 * lowers both, so the margin compares across forms and this floor could go back
 * to being `bandFor`. That needs `argmax` to report the runner-up and every
 * `minBand` in `archetypes.ts` recalibrated against a corpus larger than the
 * parity fixtures, so it is not this change.
 *
 * **Why 0.40.** After softmax the "unknown" cell sits at roughly 0.27 (see
 * `UNKNOWN_BASELINE_LOGIT` in `likelihood-ratios.ts`). The rule this encodes is
 * that a role must beat the "I don't know" hypothesis by a clear margin, not
 * merely edge past it. 0.40 clears that baseline and still leaves headroom
 * under the lowest true positive observed in the parity fixtures. Move it with
 * the baseline: the parity spec pins that measurement and will fail if the
 * lowest true positive drops toward this floor.
 *
 * Compared against the field's overall score rather than the individual role's,
 * because `allScores` is optional on the port and engines that don't populate
 * it would silently get no floor at all.
 */
export const CARD_FILL_SCORE_FLOOR = 0.4;

/**
 * Picks the field to fill for each card slot.
 *
 * @param eligibleFields Fields already filtered for fillability — viewable, not
 *   an excluded input type. The caller owns that filter because it is the same
 *   filter the keyword path applies, and the two must not drift.
 * @param qualification The page's classification. A field the engine has no
 *   answer for is skipped rather than guessed at.
 * @param floor Minimum score to fill into a field. Defaults to
 *   {@link CARD_FILL_SCORE_FLOOR}; a parameter so a test can state the bar it
 *   is exercising rather than depending on the current default.
 */
export function selectCardFillFields(
  eligibleFields: ReadonlyArray<AutofillField>,
  qualification: PageQualification,
  floor: number = CARD_FILL_SCORE_FLOOR,
): { [key: string]: AutofillField } {
  const fillFields: { [key: string]: AutofillField } = {};

  for (const field of eligibleFields) {
    const classification = qualification.fieldFor(field.opid);
    if (!classification || classification.score < floor) {
      continue;
    }

    for (const [key, role] of CARD_SLOTS) {
      if (!fillFields[key] && classification.matchedRoles.has(role)) {
        fillFields[key] = field;
        break;
      }
    }
  }

  return fillFields;
}
