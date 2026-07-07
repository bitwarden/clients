export type TabMessage =
  | CopyTextTabMessage
  | ClearClipboardTabMessage
  | GetClickedElementTabMessage
  | CollectAutofillTriageTabMessage;

export type TabMessageBase<T extends string> = {
  command: T;
};

type CopyTextTabMessage = TabMessageBase<"copyText"> & {
  text: string;
};

type ClearClipboardTabMessage = TabMessageBase<"clearClipboard">;

type GetClickedElementTabMessage = TabMessageBase<"getClickedElement">;

type CollectAutofillTriageTabMessage = TabMessageBase<"collectAutofillTriage">;
