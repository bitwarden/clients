// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AutofillFieldQualifierType } from "@bitwarden/common/autofill/types";
// String values affect code flow in autofill.ts and must not be changed
export type FillScriptActions =
  | "click_on_opid"
  | "focus_by_opid"
  | "fill_by_opid"
  | "fill_by_targeted_field_type"
  | "click_on_targeted_field_type"
  | "focus_by_targeted_field_type";

export type FillScript = [
  action: FillScriptActions,
  actionTarget: AutofillFieldQualifierType | string,
  value?: string,
];

export type AutofillScriptProperties = {
  delay_between_operations?: number;
};

export type AutofillInsertActions = {
  fill_by_opid: ({ opid, value }: { opid: string; value: string }) => void;
  click_on_opid: ({ opid }: { opid: string }) => void;
  focus_by_opid: ({ opid }: { opid: string }) => void;
  fill_by_targeted_field_type: ({
    fieldType,
    value,
  }: {
    fieldType: AutofillFieldQualifierType;
    value: string;
  }) => void;
  click_on_targeted_field_type: ({ fieldType }: { fieldType: AutofillFieldQualifierType }) => void;
  focus_by_targeted_field_type: ({ fieldType }: { fieldType: AutofillFieldQualifierType }) => void;
};

export default class AutofillScript {
  script: FillScript[] = [];
  properties: AutofillScriptProperties = {};
  metadata: any = {}; // Unused, not written or read
  autosubmit: string[]; // Appears to be unused, read but not written
  savedUrls: string[];
  untrustedIframe: boolean;
  itemType: string; // Appears to be unused, read but not written
}
