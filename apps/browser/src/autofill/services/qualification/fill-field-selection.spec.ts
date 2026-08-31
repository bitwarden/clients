import AutofillField from "../../models/autofill-field";
import { PageQualification } from "../../qualification/abstractions/qualification-engine";
import { FieldClassification } from "../../qualification/types/classification";
import { FieldRole } from "../../qualification/types/field-role";

import { CARD_FILL_SCORE_FLOOR, selectCardFillFields } from "./fill-field-selection";

function field(opid: string): AutofillField {
  const f = new AutofillField();
  f.opid = opid;
  f.viewable = true;
  return f;
}

function classification(role: FieldRole, score: number): FieldClassification {
  return {
    matchedRoles: new Set([role]),
    matchedFormContexts: new Set(),
    topRole: role,
    confidence: "low",
    score,
    allScores: [],
  };
}

function qualification(byOpid: Record<string, FieldClassification>): PageQualification {
  return {
    fieldFor: (opid) => byOpid[opid] ?? null,
    formFor: () => null,
    scenario: () => null,
  };
}

describe("selectCardFillFields", () => {
  it("claims one slot per field, in slot order", () => {
    const fields = [field("cn"), field("cv")];
    const q = qualification({
      cn: classification(FieldRole.CardNumber, 1),
      cv: classification(FieldRole.CardCvv, 1),
    });

    expect(selectCardFillFields(fields, q)).toEqual({ number: fields[0], code: fields[1] });
  });

  it("skips a field the engine has no answer for", () => {
    const fields = [field("cn"), field("unknown")];
    const q = qualification({ cn: classification(FieldRole.CardNumber, 1) });

    expect(selectCardFillFields(fields, q)).toEqual({ number: fields[0] });
  });

  describe("confidence floor", () => {
    // The floor is the whole reason fill does not simply inherit the inline
    // menu's threshold. A role below it is dropped, and the slot is left
    // unclaimed — the cipher value goes nowhere rather than somewhere wrong.
    it("refuses a field scored below the floor", () => {
      const fields = [field("cn")];
      const q = qualification({
        cn: classification(FieldRole.CardNumber, CARD_FILL_SCORE_FLOOR - 0.01),
      });

      expect(selectCardFillFields(fields, q)).toEqual({});
    });

    it("accepts a field scored exactly at the floor", () => {
      const fields = [field("cn")];
      const q = qualification({ cn: classification(FieldRole.CardNumber, CARD_FILL_SCORE_FLOOR) });

      expect(selectCardFillFields(fields, q)).toEqual({ number: fields[0] });
    });

    it("leaves a slot unclaimed rather than handing it to a weaker field", () => {
      // The failure this rules out: a rejected field must not free its slot for
      // some later low-confidence field that happens to match the same role.
      const strong = field("cn");
      const weak = field("maybe");
      const q = qualification({
        cn: classification(FieldRole.CardNumber, 0.1),
        maybe: classification(FieldRole.CardNumber, 0.2),
      });

      expect(selectCardFillFields([strong, weak], q)).toEqual({});
    });

    it("is a parameter, so a caller can state the bar it needs", () => {
      const fields = [field("cn")];
      const q = qualification({ cn: classification(FieldRole.CardNumber, 0.2) });

      expect(selectCardFillFields(fields, q)).toEqual({});
      expect(selectCardFillFields(fields, q, 0.1)).toEqual({ number: fields[0] });
    });

    it("sits above the unknown-hypothesis baseline", () => {
      // `UNKNOWN_BASELINE_LOGIT` puts an "I don't know" cell at roughly 0.27
      // after softmax. A role has to beat that by a margin, not edge past it.
      expect(CARD_FILL_SCORE_FLOOR).toBeGreaterThan(0.27);
    });
  });
});
