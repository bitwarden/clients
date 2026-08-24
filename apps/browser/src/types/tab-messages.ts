export type TabMessage =
  | CopyTextTabMessage
  | ClearClipboardTabMessage
  | GetClickedElementTabMessage
  | CollectAutofillTriageTabMessage
  | WebmapperGetSelectorTabMessage
  | WebmapperGetContainerCandidatesTabMessage;

export type TabMessageBase<T extends string> = {
  command: T;
};

type CopyTextTabMessage = TabMessageBase<"copyText"> & {
  text: string;
};

type ClearClipboardTabMessage = TabMessageBase<"clearClipboard">;

type GetClickedElementTabMessage = TabMessageBase<"getClickedElement">;

type CollectAutofillTriageTabMessage = TabMessageBase<"collectAutofillTriage">;

type WebmapperGetSelectorTabMessage = TabMessageBase<"webmapperGetSelector">;

type WebmapperGetContainerCandidatesTabMessage =
  TabMessageBase<"webmapperGetContainerCandidates"> & {
    fieldSelectors: string[];
  };
