/**
 * Returns whether the current environment supports folder selection for Send.
 *
 * Uses the `webkitdirectory` attribute on an input element to allow folder picking,
 * and relies on `File.webkitRelativePath` (Baseline 2025) to read relative paths.
 */
export function supportsFolderSend(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return "webkitdirectory" in document.createElement("input");
}
