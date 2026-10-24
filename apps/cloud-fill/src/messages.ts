import AutofillPageDetails from "@bitwarden/browser/autofill/models/autofill-page-details";
import AutofillScript from "@bitwarden/browser/autofill/models/autofill-script";

export const CollectCommand = "cloudFillCollect";
export const InspectCommand = "cloudFillInspect";
export const FillCommand = "cloudFillFill";

export type CollectMessage = { command: typeof CollectCommand; expectedUrl: string };
export type CollectResponse =
  { ok: true; pageDetails: AutofillPageDetails; documentNonce: string } | { ok: false };

export type InspectMessage = {
  command: typeof InspectCommand;
  expectedUrl: string;
  opids: string[];
};
export type InspectResponse =
  { ok: true; formless: boolean; submitTargets: string[] } | { ok: false };

export type FillMessage = {
  command: typeof FillCommand;
  expectedUrl: string;
  documentNonce: string;
  fillScript: AutofillScript;
};
export type FillResponse = { ok: boolean };

export type FillStatus =
  | "ok"
  | "no_tab"
  | "refused_origin"
  | "refused_form_action"
  | "not_filled"
  | "busy"
  | "not_paired"
  | "relay_error"
  | "no_fields"
  | "page_changed"
  | "error";

export type FillResult = { status: FillStatus; filledFields?: number; origin?: string };
