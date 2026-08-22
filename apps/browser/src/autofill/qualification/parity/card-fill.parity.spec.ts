import AutofillField from "../../models/autofill-field";
import AutofillForm from "../../models/autofill-form";
import AutofillPageDetails from "../../models/autofill-page-details";
import { AutoFillConstants } from "../../services/autofill-constants";
import AutofillService from "../../services/autofill.service";
import {
  CARD_FILL_SCORE_FLOOR,
  selectCardFillFields,
} from "../../services/qualification/fill-field-selection";
import { bandFor } from "../classification";
import { ScoringQualificationEngine } from "../engine";

type SlotSelection = Readonly<Record<string, string | undefined>>;

type Fixture = {
  readonly name: string;
  readonly pageDetails: AutofillPageDetails;
};

/**
 * Fill-time parity: engine-selected card fields vs keyword-selected card fields.
 *
 * Same contract as `parity.spec.ts`, applied one layer down. That file compares
 * what the two engines *say* about a page; this one compares what actually gets
 * filled, which is the thing a user notices. A field selected for the wrong slot
 * here types a card number into a CVV box.
 *
 * Divergences are documented per fixture and asserted exactly. An undocumented
 * one fails, and so does drift on a documented one.
 */
describe("Card fill parity (engine ↔ keyword tables)", () => {
  let engine: ScoringQualificationEngine;

  beforeEach(() => {
    engine = new ScoringQualificationEngine();
  });

  describe("checkout form with autocomplete attributes", () => {
    it("selects the same field for every slot", () => {
      const { pageDetails } = attributedCheckoutFixture();

      expect(engineSelection(engine, pageDetails)).toEqual(keywordSelection(pageDetails));
    });
  });

  describe("checkout form with no autocomplete attributes", () => {
    it("selects the same field for every slot", () => {
      // The case the keyword tables were written for. If the engine can't match
      // parity here it has no business at fill time.
      const { pageDetails } = unattributedCheckoutFixture();

      expect(engineSelection(engine, pageDetails)).toEqual(keywordSelection(pageDetails));
    });
  });

  describe("checkout form with split expiry month + year", () => {
    it("selects the same field for every slot", () => {
      const { pageDetails } = splitExpiryFixture();

      expect(engineSelection(engine, pageDetails)).toEqual(keywordSelection(pageDetails));
    });
  });

  describe("checkout form with a brand selector", () => {
    it("selects the same field for every slot", () => {
      // `brand` is the one slot the inline menu never qualified, so this is the
      // first time the engine has had to have an opinion about it at all.
      const { pageDetails } = brandSelectorFixture();
      const selection = engineSelection(engine, pageDetails);

      expect(selection).toEqual(keywordSelection(pageDetails));
      expect(selection.brand).toBe("cb");
      expect(selection.number).toBe("cn");
    });
  });

  describe("checkout form with a hidden card number", () => {
    it("skips the non-viewable field in both paths", () => {
      // Both implementations require viewability. The engine path applies it as
      // a pre-filter rather than inside an attribute loop, so this pins that the
      // two filters agree.
      const { pageDetails } = attributedCheckoutFixture();
      pageDetails.fields.find((f) => f.opid === "cn")!.viewable = false;

      const selection = engineSelection(engine, pageDetails);

      expect(selection).toEqual(keywordSelection(pageDetails));
      expect(selection.number).toBeUndefined();
    });
  });

  /**
   * The measurement `CARD_FILL_SCORE_FLOOR` is derived from.
   *
   * That constant is a raw score rather than a confidence band, and the
   * comment justifying it rests on two facts about this corpus. Neither is
   * visible in the parity assertions above — those run *with* the floor, so a
   * true positive scoring under it would drop out of both sides and still
   * compare equal. Both are asserted here so a change to the likelihood ratios
   * or to `UNKNOWN_BASELINE_LOGIT` fails loudly instead of quietly invalidating
   * the derivation.
   */
  describe("score distribution behind CARD_FILL_SCORE_FLOOR", () => {
    it("keeps every field the keyword path fills above the floor", () => {
      const scores = truePositiveScores(engine);

      expect(scores.length).toBeGreaterThan(0);
      expect(Math.min(...scores)).toBeGreaterThanOrEqual(CARD_FILL_SCORE_FLOOR);
    });

    it("leaves at least one below the high band, so a band floor would reject it", () => {
      // Currently the CVV and the brand selector on the unattributed checkout,
      // both at ~0.527 against a 0.55 cutoff. This is the fact that makes the
      // raw number necessary; if it ever stops holding, the floor can and
      // should become `bandFor`.
      const scores = truePositiveScores(engine);

      expect(bandFor(Math.min(...scores))).toBe("low");
    });
  });
});

/**
 * Every field both paths agree is a card field, scored.
 *
 * Selected with no floor, so the floor's own effect can be measured rather
 * than assumed away.
 */
function truePositiveScores(engine: ScoringQualificationEngine): number[] {
  const fixtures = [
    attributedCheckoutFixture,
    unattributedCheckoutFixture,
    splitExpiryFixture,
    brandSelectorFixture,
  ];

  return fixtures.flatMap((makeFixture) => {
    const { pageDetails } = makeFixture();
    const qualification = engine.classify(pageDetails);
    const keyword = keywordSelection(pageDetails);

    return Object.entries(engineSelection(engine, pageDetails, 0))
      .filter(([slot, opid]) => opid !== undefined && keyword[slot] === opid)
      .map(([, opid]) => qualification.fieldFor(opid as string)!.score);
  });
}

/** The slots and their chosen field, as opids. */
function engineSelection(
  engine: ScoringQualificationEngine,
  pageDetails: AutofillPageDetails,
  floor?: number,
): SlotSelection {
  const eligible = pageDetails.fields.filter(
    (f) =>
      f.viewable &&
      !AutofillService.isExcludedFieldType(f, AutoFillConstants.ExcludedAutofillTypes),
  );
  return toOpids(selectCardFillFields(eligible, engine.classify(pageDetails), floor));
}

function keywordSelection(pageDetails: AutofillPageDetails): SlotSelection {
  return toOpids(AutofillService["selectCardFillFieldsByKeyword"](pageDetails));
}

function toOpids(fillFields: { [key: string]: AutofillField }): SlotSelection {
  const out: Record<string, string | undefined> = {};
  for (const slot of ["cardholderName", "number", "exp", "expMonth", "expYear", "code", "brand"]) {
    out[slot] = fillFields[slot]?.opid;
  }
  return out;
}

function attributedCheckoutFixture(): Fixture {
  return checkoutFixture("checkout (autocomplete)", [
    field({ opid: "ch", n: 0, autoCompleteType: "cc-name", html: "cardholderName" }),
    field({ opid: "cn", n: 1, autoCompleteType: "cc-number", html: "cardNumber" }),
    field({ opid: "ce", n: 2, autoCompleteType: "cc-exp", html: "cardExpiration" }),
    field({ opid: "cv", n: 3, autoCompleteType: "cc-csc", html: "cardCvv" }),
  ]);
}

function unattributedCheckoutFixture(): Fixture {
  return checkoutFixture("checkout (no autocomplete)", [
    field({ opid: "ch", n: 0, html: "cardholderName" }),
    field({ opid: "cn", n: 1, html: "cardNumber" }),
    field({ opid: "ce", n: 2, html: "cardExpiration" }),
    field({ opid: "cv", n: 3, html: "cardCvv" }),
  ]);
}

function brandSelectorFixture(): Fixture {
  return checkoutFixture("checkout (brand selector)", [
    field({ opid: "cn", n: 0, html: "cardNumber" }),
    field({ opid: "cb", n: 1, html: "cardType", type: "select-one" }),
    field({ opid: "ce", n: 2, html: "cardExpiration" }),
    field({ opid: "cv", n: 3, html: "cardCvv" }),
  ]);
}

function splitExpiryFixture(): Fixture {
  return checkoutFixture("checkout (split expiry)", [
    field({ opid: "ch", n: 0, autoCompleteType: "cc-name", html: "cardholderName" }),
    field({ opid: "cn", n: 1, autoCompleteType: "cc-number", html: "cardNumber" }),
    field({ opid: "em", n: 2, autoCompleteType: "cc-exp-month", html: "expMonth" }),
    field({ opid: "ey", n: 3, autoCompleteType: "cc-exp-year", html: "expYear" }),
    field({ opid: "cv", n: 4, autoCompleteType: "cc-csc", html: "cardCvv" }),
  ]);
}

function checkoutFixture(name: string, fields: AutofillField[]): Fixture {
  const form = new AutofillForm();
  form.opid = "__form__0";
  form.htmlName = "";
  form.htmlID = "";
  form.htmlAction = "/checkout";
  form.htmlMethod = "post";
  form.htmlClass = "";
  form.htmlAncestorHeadings = [];
  form.submitButtonText = ["Pay now"];

  const pd = new AutofillPageDetails();
  pd.title = "Checkout";
  pd.url = "https://example.test/checkout";
  pd.documentUrl = pd.url;
  pd.fields = fields;
  pd.forms = { __form__0: form };
  pd.collectedTimestamp = 0;

  return { name, pageDetails: pd };
}

function field(args: {
  opid: string;
  n: number;
  html: string;
  type?: string;
  autoCompleteType?: string;
}): AutofillField {
  const f = new AutofillField();
  f.opid = args.opid;
  f.elementNumber = args.n;
  f.viewable = true;
  f.htmlID = args.html;
  f.htmlName = args.html;
  f.htmlClass = null;
  f.tabindex = null;
  f.title = null;
  f.type = args.type ?? "text";
  f.placeholder = null;
  f.autoCompleteType = args.autoCompleteType ?? null;
  f.form = "__form__0";
  return f;
}
