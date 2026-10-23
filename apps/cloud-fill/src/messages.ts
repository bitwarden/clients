import AutofillPageDetails from "@bitwarden/browser/autofill/models/autofill-page-details";
import AutofillScript from "@bitwarden/browser/autofill/models/autofill-script";

export const CollectCommand = "cloudFillCollect";
export const FillCommand = "cloudFillFill";

export type CollectMessage = { command: typeof CollectCommand; expectedUrl: string };
export type CollectResponse = { ok: true; pageDetails: AutofillPageDetails } | { ok: false };

export type FillMessage = {
  command: typeof FillCommand;
  expectedUrl: string;
  fillScript: AutofillScript;
};
export type FillResponse = { ok: boolean };

/** Outcome reported to whoever triggered the fill. Never carries credential data. */
export type FillStatus =
  | "ok"
  | "no_tab"
  | "refused_origin"
  | "refused_form_action"
  | "no_credential"
  | "no_fields"
  | "page_changed"
  | "error";

export type FillResult = { status: FillStatus; filledFields?: number };
