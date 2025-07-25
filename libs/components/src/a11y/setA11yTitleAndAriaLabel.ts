export function setA11yTitleAndAriaLabel(element: HTMLElement, title: string): void {
  if (!element.hasAttribute("title")) {
    element.setAttribute("title", title);
  }
  if (!element.hasAttribute("aria-label")) {
    element.setAttribute("aria-label", title);
  }
}
