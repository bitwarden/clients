export function setA11yTitleAndAriaLabel({
  element,
  title,
  label,
}: {
  element: HTMLElement;
  title?: string;
  label?: string;
}): void {
  if (title) {
    element.setAttribute("title", title);
  }
  if (label) {
    element.setAttribute("aria-label", label);
  }
}
