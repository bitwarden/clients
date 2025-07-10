export type TabMessage =
  | CopyTextTabMessage
  | ClearClipboardTabMessage
  | GetClickedElementTabMessage;

export type TabMessageBase<T extends string> = {
  command: T;
};

type CopyTextTabMessage = TabMessageBase<"copyText"> & {
  text: string;
};

type ClearClipboardTabMessage = TabMessageBase<"clearClipboard">;

type GetClickedElementTabMessage = TabMessageBase<"getClickedElement">;
