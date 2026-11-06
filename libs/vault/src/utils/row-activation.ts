/**
 * Elements that own their own click behaviour. A click originating inside one of these must not
 * also activate the row it sits in.
 */
const InteractiveSelector = [
  "a[href]",
  "button",
  "input",
  "label",
  "select",
  "textarea",
  "[role='button']",
  "[role='menuitem']",
  "[role='checkbox']",
].join(",");

/**
 * Whether a click on a table data cell should activate its row (open the item, navigate to the
 * folder, ...). Pointer-only — the keyboard and assistive-tech path stays the row's name element.
 *
 * Returns `false` for:
 * - anything but a plain primary click, so modifier clicks stay available for selection and
 *   browser gestures;
 * - clicks inside an interactive descendant (name link, checkbox, menu, buttons), which win;
 * - clicks that finish a text selection, so copying text out of a row doesn't activate it.
 */
export function isRowActivationClick(event: MouseEvent): boolean {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return false;
  }

  const target = event.target;
  if (target instanceof Element && target.closest(InteractiveSelector) != null) {
    return false;
  }

  const selection = window.getSelection();
  if (selection != null && !selection.isCollapsed && selection.toString().trim().length > 0) {
    return false;
  }

  return true;
}
