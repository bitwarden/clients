import { Component, ElementRef } from "@angular/core";

@Component({
  selector: "navigatable-list-item",
  templateUrl: "navigatable-list-item.component.html",
})
export class NavigatableListItemComponent {
  constructor(private element: ElementRef) {}

  focus() {
    this.getFocusableElement(this.element.nativeElement)?.focus();
  }

  private getFocusableElement(el: Element): HTMLElement {
    if (this.isFocusableElement(el)) {
      return el as HTMLElement;
    }

    for (let i = 0; i < el.children.length; i++) {
      const focusable = this.getFocusableElement(el.children[i]);
      if (focusable) {
        return focusable;
      }
    }

    return null;
  }

  private isFocusableElement(el: Element): boolean {
    return (
      el.getAttribute("tabindex") == "0" ||
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLAnchorElement ||
      el instanceof HTMLButtonElement
    );
  }
}
