export type KeyManagerItem = HTMLElement & { disabled?: boolean };

export type KeyManagerOptions<T extends KeyManagerItem> = {
  /** Returns the current items; called on every keypress so dynamic lists stay correct. */
  items: () => T[];
  orientation?: "vertical" | "horizontal" | "both";
  wrap?: boolean;
  /** Enables jump-to-item by typing its first letters. */
  typeahead?: boolean;
  /** Skip disabled items while navigating. Defaults to true. */
  skipDisabled?: boolean;
  /** Move DOM focus to the active item (roving focus). When false, only `onActiveChange` fires. */
  focusItems?: boolean;
  onActiveChange?: (item: T | undefined, index: number) => void;
};

/**
 * Arrow-key, Home/End and typeahead navigation over a list of items, replacing the CDK's
 * `FocusKeyManager` / `ActiveDescendantKeyManager`.
 */
export class KeyManager<T extends KeyManagerItem> {
  activeIndex = -1;
  private typeaheadBuffer = "";
  private typeaheadTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly options: KeyManagerOptions<T>) {}

  get activeItem(): T | undefined {
    return this.options.items()[this.activeIndex];
  }

  setActiveItem(indexOrItem: number | T) {
    const items = this.options.items();
    const index = typeof indexOrItem === "number" ? indexOrItem : items.indexOf(indexOrItem);
    this.activeIndex = index;
    const item = items[index];
    if (item && this.options.focusItems !== false) {
      item.focus();
    }
    this.options.onActiveChange?.(item, index);
  }

  setFirstItemActive() {
    this.setActiveItem(this.step(-1, 1, false));
  }

  setLastItemActive() {
    this.setActiveItem(this.step(this.options.items().length, -1, false));
  }

  /** Returns true if the event was handled (caller should `preventDefault`). */
  onKeydown(event: KeyboardEvent): boolean {
    const { orientation = "vertical", wrap = true } = this.options;
    const vertical = orientation !== "horizontal";
    const horizontal = orientation !== "vertical";
    const rtl =
      getComputedStyle((event.currentTarget as Element) ?? document.body).direction === "rtl";

    let next: number | undefined;
    switch (event.key) {
      case "ArrowDown":
        next = vertical ? this.step(this.activeIndex, 1, wrap) : undefined;
        break;
      case "ArrowUp":
        next = vertical ? this.step(this.activeIndex, -1, wrap) : undefined;
        break;
      case "ArrowRight":
        next = horizontal ? this.step(this.activeIndex, rtl ? -1 : 1, wrap) : undefined;
        break;
      case "ArrowLeft":
        next = horizontal ? this.step(this.activeIndex, rtl ? 1 : -1, wrap) : undefined;
        break;
      case "Home":
        next = this.step(-1, 1, false);
        break;
      case "End":
        next = this.step(this.options.items().length, -1, false);
        break;
      default:
        if (
          this.options.typeahead &&
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          return this.onTypeahead(event.key);
        }
        return false;
    }

    if (next === undefined || next < 0) {
      return false;
    }
    this.setActiveItem(next);
    return true;
  }

  private isSkippable(item: T) {
    return (
      this.options.skipDisabled !== false &&
      (item.disabled || item.getAttribute("aria-disabled") === "true")
    );
  }

  private step(from: number, delta: 1 | -1, wrap: boolean): number {
    const items = this.options.items();
    const count = items.length;
    for (let i = 1; i <= count; i++) {
      let index = from + delta * i;
      if (wrap) {
        index = (index + count) % count;
      } else if (index < 0 || index >= count) {
        return -1;
      }
      if (!this.isSkippable(items[index])) {
        return index;
      }
    }
    return -1;
  }

  private onTypeahead(char: string): boolean {
    clearTimeout(this.typeaheadTimer);
    this.typeaheadBuffer += char.toLowerCase();
    this.typeaheadTimer = setTimeout(() => (this.typeaheadBuffer = ""), 500);
    const items = this.options.items();
    const count = items.length;
    for (let i = 1; i <= count; i++) {
      const index = (this.activeIndex + i) % count;
      const item = items[index];
      if (
        !this.isSkippable(item) &&
        item.textContent?.trim().toLowerCase().startsWith(this.typeaheadBuffer)
      ) {
        this.setActiveItem(index);
        return true;
      }
    }
    return false;
  }
}
