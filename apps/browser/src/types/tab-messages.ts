export type TabMessage =
  | CopyTextTabMessage
  | ClearClipboardTabMessage
  | GetClickedElementTabMessage
  | GetClickedElementPathTabMessage;

export type TabMessageBase<T extends string> = {
  command: T;
};

type CopyTextTabMessage = TabMessageBase<"copyText"> & {
  text: string;
};

type ClearClipboardTabMessage = TabMessageBase<"clearClipboard">;

type GetClickedElementTabMessage = TabMessageBase<"getClickedElement">;

type GetClickedElementPathTabMessage = TabMessageBase<"getClickedElementPath">;
