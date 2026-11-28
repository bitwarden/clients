import { ElementPart, nothing } from "lit";
import { Directive, directive, PartInfo, PartType } from "lit/directive.js";

/**
 * Clicking an element with this attribute inside a dialog or drawer closes it, with the attribute
 * value (or the element's `dialogCloseResult` property) as the result. The element is disabled
 * while the dialog's `disableClose` is set. Replaces `bitDialogClose`.
 *
 * ```html
 * <bit-button data-bit-dialog-close>Cancel</bit-button>
 * ```
 */
export const DIALOG_CLOSE_ATTRIBUTE = "data-bit-dialog-close";

class DialogCloseDirective extends Directive {
  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error("dialogClose() must be used in an element position");
    }
  }

  render(_result?: unknown) {
    return nothing;
  }

  update(part: ElementPart, [result]: Parameters<this["render"]>) {
    const el = part.element as HTMLElement & { dialogCloseResult?: unknown };
    el.setAttribute(DIALOG_CLOSE_ATTRIBUTE, "");
    el.dialogCloseResult = result;
    return nothing;
  }
}

/**
 * Closes the surrounding dialog with `result` when the element is clicked.
 *
 * ```ts
 * html`<bit-button ${dialogClose(true)}>Confirm</bit-button>`
 * ```
 */
export const dialogClose = directive(DialogCloseDirective);
