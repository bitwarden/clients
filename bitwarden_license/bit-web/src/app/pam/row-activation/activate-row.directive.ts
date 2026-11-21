import { Directive } from "@angular/core";

/**
 * Marks the control a row's whitespace activates. Put it on the link or button that already
 * carries the row's primary action, so the row keeps ONE activation path: pointer users get the
 * whole row, keyboard users get the control itself, with its own focus ring and semantics.
 *
 * A plain attribute rather than a directive, following `data-selection-input`: nothing has to be
 * imported into a template to mark a cell's control.
 */
const ROW_ACTIVATOR_ATTRIBUTE = "data-pam-row-activator";

/**
 * Elements that own their own click. A click landing on one is that control's, never the row's,
 * so the row stands down rather than running both.
 */
const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='menuitem']",
  "[contenteditable='true']",
].join(",");

/**
 * Makes a `<bit-table-v2>`'s rows clickable end to end: a click on a row's whitespace forwards to
 * the control marked `data-pam-row-activator` in that row. `bit-row` fills on hover, which reads
 * as "this row is clickable", but only the name cell's link ever was (PAM-405).
 *
 * Delegated from the table rather than bound per cell, because rows are rendered by the table (and
 * recycled by the virtual scroller), so there is no `<bit-row>` in a consumer's template to bind.
 * That also keeps a row's cells free of a repeated handler each new column would have to remember.
 *
 * It forwards to the row's own control rather than taking a callback, so the pointer and the
 * keyboard run one navigation or dialog, and a row with nothing to activate (a skeleton row, a
 * group header) is inert.
 */
@Directive({
  selector: "[pamActivateRow]",
  host: {
    // Only rows that have somewhere to go get the affordance.
    class: "[&_bit-row:has([data-pam-row-activator])]:tw-cursor-pointer",
    "(click)": "onClick($event)",
  },
})
export class PamActivateRowDirective {
  protected onClick(event: MouseEvent) {
    // Leave modified and secondary clicks to the browser: they open a new tab or a context menu,
    // and synthesizing a plain click here would swallow that.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    // A control inside the row has already handled this click — including the activator itself,
    // which is how the forwarded click below stops rather than re-entering.
    if (target.closest(INTERACTIVE_SELECTOR) != null) {
      return;
    }

    const row = target.closest("bit-row");
    if (row == null) {
      return;
    }

    // Dragging across a row to copy a value ends in a click. Copying is not activating.
    if (hasSelectionWithin(row)) {
      return;
    }

    row.querySelector<HTMLElement>(`[${ROW_ACTIVATOR_ATTRIBUTE}]`)?.click();
  }
}

/** Whether the document's selection covers text inside `row`, as a drag-select leaves it. */
function hasSelectionWithin(row: Element): boolean {
  const selection = row.ownerDocument.defaultView?.getSelection();
  if (selection == null || selection.isCollapsed || selection.toString().trim() === "") {
    return false;
  }

  const anchor = selection.anchorNode;
  return anchor != null && row.contains(anchor);
}
