/** A file-open dialog request from the renderer, mirroring the `<input type="file">` it replaces. */
export type PickFilesOptions = {
  /** Allow choosing more than one file (`<input multiple>`). */
  multiple?: boolean;
  /**
   * The input's comma separated `accept` list, e.g. ".json,.csv". Only a hint for the dialog's
   * file type filter, never validation.
   */
  accept?: string;
};

/** A file chosen in the main process dialog, read into memory for the renderer. */
export type PickedFile = {
  name: string;
  /** Exactly the file's bytes, so the renderer can wrap them in a `File` without copying. */
  data: Uint8Array<ArrayBuffer>;
};
