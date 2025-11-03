export type FillScript = [action: FillScriptActions, opid: string, value?: string];

export type AutofillScriptProperties = {
  delay_between_operations?: number;
};

export const FillScriptActionTypes = {
  fill_by_opid: "fill_by_opid",
  click_on_opid: "click_on_opid",
  focus_by_opid: "focus_by_opid",
} as const;

// String values affect code flow in autofill.ts and must not be changed
export type FillScriptActions = keyof typeof FillScriptActionTypes;

export type AutofillInsertActions = {
  [FillScriptActionTypes.fill_by_opid]: ({ opid, value }: { opid: string; value: string }) => void;
  [FillScriptActionTypes.click_on_opid]: ({ opid }: { opid: string }) => void;
  [FillScriptActionTypes.focus_by_opid]: ({ opid }: { opid: string }) => void;
};

export default class AutofillScript {
  script: FillScript[] = [];
  properties: AutofillScriptProperties = {};
  autosubmit!: string[] | null; // Appears to be unused, read but not written
  savedUrls!: string[];
  untrustedIframe!: boolean;
  itemType!: string; // Appears to be unused, read but not written
}
