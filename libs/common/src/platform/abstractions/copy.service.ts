import { ClipboardOptions } from "@bitwarden/common/platform/abstractions/platform-utils.service";

export abstract class CopyService {
  /**
   * Copy the provided text to the user's clipboard using platform util service.
   * @param text - The text to copy to the clipboard.
   * @param options - Optional clipboard copy options.
   */
  abstract copyToClipboard(text: string, options?: ClipboardOptions): void | boolean;
}
