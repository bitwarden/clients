import { Directive, ElementRef, HostListener } from "@angular/core";

/**
 * Directive that adds arrow key navigation to the vault popup.
 *
 * - ArrowDown: From search → first list item. From item → next item.
 * - ArrowUp: From item → previous item. From first item → search.
 * - ArrowRight: Cycle forward through action buttons within the current item row.
 * - ArrowLeft: Cycle backward through action buttons within the current item row.
 */
@Directive({
  selector: "[appVaultArrowNav]",
  standalone: true,
})
export class VaultArrowNavDirective {
  constructor(private el: ElementRef<HTMLElement>) {}

  @HostListener("keydown", ["$event"])
  onKeyDown(event: KeyboardEvent): void {
    const arrowKeys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"];
    if (!arrowKeys.includes(event.key)) {
      return;
    }

    const target = event.target as HTMLElement;

    switch (event.key) {
      case "ArrowDown":
        this.handleArrowDown(target, event);
        break;
      case "ArrowUp":
        this.handleArrowUp(target, event);
        break;
      case "ArrowRight":
        this.handleArrowRight(target, event);
        break;
      case "ArrowLeft":
        this.handleArrowLeft(target, event);
        break;
    }
  }

  private handleArrowDown(target: HTMLElement, event: KeyboardEvent): void {
    // If currently in the search input, jump to first list item
    if (this.isInSearchInput(target)) {
      const firstItemButton = this.getFirstItemContentButton();
      if (firstItemButton) {
        event.preventDefault();
        firstItemButton.focus();
      }
      return;
    }

    // If currently in a list item, move to next item
    const currentItem = this.getClosestBitItem(target);
    if (currentItem) {
      const nextItem = this.getNextBitItem(currentItem);
      if (nextItem) {
        const nextButton = this.getItemContentButton(nextItem);
        if (nextButton) {
          event.preventDefault();
          nextButton.focus();
          this.scrollIntoViewIfNeeded(nextButton);
        }
      }
    }
  }

  private handleArrowUp(target: HTMLElement, event: KeyboardEvent): void {
    const currentItem = this.getClosestBitItem(target);
    if (!currentItem) {
      return;
    }

    const prevItem = this.getPreviousBitItem(currentItem);
    if (prevItem) {
      const prevButton = this.getItemContentButton(prevItem);
      if (prevButton) {
        event.preventDefault();
        prevButton.focus();
        this.scrollIntoViewIfNeeded(prevButton);
      }
    } else {
      // At the first item — return focus to search
      const searchInput = this.getSearchInput();
      if (searchInput) {
        event.preventDefault();
        searchInput.focus();
      }
    }
  }

  private handleArrowRight(target: HTMLElement, event: KeyboardEvent): void {
    const currentItem = this.getClosestBitItem(target);
    if (!currentItem) {
      return;
    }

    const focusableButtons = this.getFocusableButtonsInItem(currentItem);
    const currentIndex = focusableButtons.indexOf(target as HTMLButtonElement);
    if (currentIndex === -1) {
      // Target may be nested inside a button; find the closest button ancestor
      const closestButton = target.closest("button") as HTMLButtonElement;
      const adjustedIndex = focusableButtons.indexOf(closestButton);
      if (adjustedIndex !== -1 && adjustedIndex < focusableButtons.length - 1) {
        event.preventDefault();
        focusableButtons[adjustedIndex + 1].focus();
      }
      return;
    }

    if (currentIndex < focusableButtons.length - 1) {
      event.preventDefault();
      focusableButtons[currentIndex + 1].focus();
    }
  }

  private handleArrowLeft(target: HTMLElement, event: KeyboardEvent): void {
    const currentItem = this.getClosestBitItem(target);
    if (!currentItem) {
      return;
    }

    const focusableButtons = this.getFocusableButtonsInItem(currentItem);
    const currentIndex = focusableButtons.indexOf(target as HTMLButtonElement);
    if (currentIndex === -1) {
      const closestButton = target.closest("button") as HTMLButtonElement;
      const adjustedIndex = focusableButtons.indexOf(closestButton);
      if (adjustedIndex > 0) {
        event.preventDefault();
        focusableButtons[adjustedIndex - 1].focus();
      }
      return;
    }

    if (currentIndex > 0) {
      event.preventDefault();
      focusableButtons[currentIndex - 1].focus();
    }
  }

  /**
   * Check if the target element is inside the search input.
   */
  private isInSearchInput(target: HTMLElement): boolean {
    return !!target.closest("bit-search");
  }

  /**
   * Get the search input element within the host.
   */
  private getSearchInput(): HTMLInputElement | null {
    return this.el.nativeElement.querySelector("bit-search input");
  }

  /**
   * Get all rendered bit-item elements in DOM order across all sections.
   */
  private getAllBitItems(): HTMLElement[] {
    return Array.from(this.el.nativeElement.querySelectorAll("bit-item"));
  }

  /**
   * Find the closest ancestor bit-item from a target element.
   */
  private getClosestBitItem(target: HTMLElement): HTMLElement | null {
    return target.closest("bit-item");
  }

  /**
   * Get the main content button for a bit-item.
   */
  private getItemContentButton(item: HTMLElement): HTMLButtonElement | null {
    return item.querySelector("button[bit-item-content]");
  }

  /**
   * Get the first item content button across all sections.
   */
  private getFirstItemContentButton(): HTMLButtonElement | null {
    const items = this.getAllBitItems();
    if (items.length === 0) {
      return null;
    }
    return this.getItemContentButton(items[0]);
  }

  /**
   * Get the next bit-item after the current one, across all sections.
   */
  private getNextBitItem(currentItem: HTMLElement): HTMLElement | null {
    const items = this.getAllBitItems();
    const currentIndex = items.indexOf(currentItem);
    if (currentIndex === -1 || currentIndex >= items.length - 1) {
      return null;
    }
    return items[currentIndex + 1];
  }

  /**
   * Get the previous bit-item before the current one, across all sections.
   */
  private getPreviousBitItem(currentItem: HTMLElement): HTMLElement | null {
    const items = this.getAllBitItems();
    const currentIndex = items.indexOf(currentItem);
    if (currentIndex <= 0) {
      return null;
    }
    return items[currentIndex - 1];
  }

  /**
   * Collect all focusable, visible buttons within a bit-item in DOM order.
   * Includes the main content button and all action buttons.
   */
  private getFocusableButtonsInItem(item: HTMLElement): HTMLButtonElement[] {
    const allButtons = Array.from(item.querySelectorAll("button")) as HTMLButtonElement[];
    return allButtons.filter((btn) => !btn.disabled && btn.offsetParent !== null);
  }

  /**
   * Scroll the element into view if it's not already visible.
   */
  private scrollIntoViewIfNeeded(element: HTMLElement): void {
    element.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
