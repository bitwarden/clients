import {
  AfterViewInit,
  booleanAttribute,
  Component,
  DestroyRef,
  ElementRef,
  HostBinding,
  HostListener,
  inject,
  Input,
  QueryList,
  signal,
  ViewChild,
  ViewChildren,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

import { compareValues } from "@bitwarden/common/platform/misc/compare-values";

import { ButtonModule } from "../button";
import { ChipSelectOption } from "../chip-select";
import { IconButtonModule } from "../icon-button";
import { MenuComponent, MenuItemDirective, MenuModule } from "../menu";
import { Option } from "../select/option";
import { SharedModule } from "../shared";
import { TypographyModule } from "../typography";

@Component({
  selector: "bit-chip-multi-select",
  templateUrl: "chip-multi-select.component.html",
  standalone: true,
  imports: [SharedModule, ButtonModule, IconButtonModule, MenuModule, TypographyModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: ChipMultiSelectComponent,
      multi: true,
    },
  ],
})
export class ChipMultiSelectComponent<T = unknown> implements ControlValueAccessor, AfterViewInit {
  @ViewChild(MenuComponent) menu: MenuComponent;
  @ViewChildren(MenuItemDirective) menuItems: QueryList<MenuItemDirective>;
  @ViewChild("chipSelectButton") chipSelectButton: ElementRef<HTMLButtonElement>;

  /** Text to show when there is no selected option */
  @Input({ required: true }) placeholderText: string;

  /** Icon to show when there is no selected option or the selected option does not have an icon */
  @Input() placeholderIcon: string;

  private _options: ChipSelectOption<T>[];
  /** The select options to render */
  @Input({ required: true })
  get options(): ChipSelectOption<T>[] {
    return this._options;
  }
  set options(value: ChipSelectOption<T>[]) {
    this._options = value;
    this.initializeRootTree(value);
  }

  /** Disables the entire chip */
  @Input({ transform: booleanAttribute }) disabled = false;

  /** Chip will stretch to full width of its container */
  @Input({ transform: booleanAttribute }) fullWidth?: boolean;

  /**
   * We have `:focus-within` and `:focus-visible` but no `:focus-visible-within`
   */
  protected focusVisibleWithin = signal(false);
  @HostListener("focusin", ["$event.target"])
  onFocusIn(target: HTMLElement) {
    this.focusVisibleWithin.set(target.matches(".fvw-target:focus-visible"));
  }
  @HostListener("focusout")
  onFocusOut() {
    this.focusVisibleWithin.set(false);
  }

  @HostBinding("class")
  get classList() {
    return ["tw-inline-block", this.fullWidth ? "tw-w-full" : "tw-max-w-52"];
  }

  private destroyRef = inject(DestroyRef);

  /** Tree constructed from `this.options` */
  private rootTree: ChipSelectOption<T>;

  /** Options that are currently displayed in the menu */
  protected renderedOptions: ChipSelectOption<T>;

  /** The option that is currently selected by the user */
  protected selectedOptions: ChipSelectOption<T>[];

  protected get anySelected(): boolean {
    return this.selectedOptions != null && this.selectedOptions.length !== 0;
  }

  /**
   * The initial calculated width of the menu when it opens, which is used to
   * keep the width consistent as the user navigates through submenus
   */
  protected menuWidth: number | null = null;

  /** The label to show in the chip button */
  protected get label(): string {
    if (this.selectedOptions == null || this.selectedOptions.length === 0) {
      return this.placeholderText;
    }

    return this.selectedOptions[0]?.label || this.placeholderText;
  }

  /** The icon to show in the chip button */
  protected get icon(): string {
    if (this.selectedOptions == null || this.selectedOptions.length === 0) {
      return this.placeholderIcon;
    }

    if (this.selectedOptions.length === 1) {
      return this.selectedOptions[0].icon ?? this.placeholderIcon;
    }

    const amount = Math.min(this.selectedOptions.length, 10);

    if (amount === 10) {
      // TODO: Should we have a 9+ icon?
      return "bwi-icon-9";
    }

    // The value should be between 2 and 9, which we have icons for.
    return `bwi-icon-${amount}`;
  }

  protected getOptionIcon(option: ChipSelectOption<T>) {
    if (this.isSelected(option)) {
      return "bwi-check";
    }

    return option.icon;
  }

  private isSelected(option: ChipSelectOption<T>) {
    if (this.selectedOptions == null) {
      return false;
    }

    return this.selectedOptions.some((o) => compareValues(o.value, option.value));
  }

  /**
   * Set the rendered options based on whether or not an option is already selected, so that the correct
   * submenu displays.
   */
  protected setOrResetRenderedOptions(): void {
    // TODO: Huh?
    this.renderedOptions = this.rootTree;
    // this.renderedOptions = this.selectedOption
    //   ? this.selectedOption.children?.length > 0
    //     ? this.selectedOption
    //     : this.getParent(this.selectedOption)
    //   : this.rootTree;
  }

  protected handleMenuClosed(): void {
    this.setOrResetRenderedOptions();
    // reset menu width so that it can be recalculated upon open
    this.menuWidth = null;
  }

  protected selectOption(option: ChipSelectOption<T>, _event: MouseEvent) {
    this.selectedOptions ??= [];
    // Check that it isn't already selected?
    const existingIndex = this.selectedOptions.findIndex((o) =>
      compareValues(o.value, option.value),
    );

    if (existingIndex === -1) {
      // Select it
      this.selectedOptions.push(option);
    } else {
      // De-select it
      this.selectedOptions.splice(existingIndex, 1);
    }

    this.onChange(this.selectedOptions);
  }

  protected viewOption(option: ChipSelectOption<T>, event: MouseEvent) {
    this.renderedOptions = option;

    /** We don't want the menu to close */
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  /** Click handler for the X button */
  protected clear() {
    this.renderedOptions = this.rootTree;
    this.selectedOptions = null;
    this.onChange(null);
  }

  /**
   * Find a `ChipSelectOption` by its value
   * @param tree the root tree to search
   * @param value the option value to look for
   * @returns the `ChipSelectOption` associated with the provided value, or null if not found
   */
  private findOptions(tree: ChipSelectOption<T>, values: T[] | null): ChipSelectOption<T>[] | null {
    if (values == null) {
      return [];
    }

    const results: ChipSelectOption<T>[] = [];
    for (const value of values) {
      if (tree.value !== null && compareValues(tree.value, value)) {
        results.push(tree);
        break;
      }

      if (Array.isArray(tree.children) && tree.children.length > 0) {
        for (const child of tree.children) {
          results.push(...this.findOptions(child, [value]));
        }
      }
    }

    return results;
  }

  /** Maps child options to their parent, to enable navigating up the tree */
  private childParentMap = new Map<ChipSelectOption<T>, ChipSelectOption<T>>();

  /** For each descendant in the provided `tree`, update `_parent` to be a refrence to the parent node. This allows us to navigate back in the menu. */
  private markParents(tree: ChipSelectOption<T>) {
    tree.children?.forEach((child) => {
      this.childParentMap.set(child, tree);
      this.markParents(child);
    });
  }

  protected getParent(option: ChipSelectOption<T>): ChipSelectOption<T> | null {
    return this.childParentMap.get(option);
  }

  private initializeRootTree(options: ChipSelectOption<T>[]) {
    /** Since the component is just initialized with an array of options, we need to construct the root tree. */
    const root: ChipSelectOption<T> = {
      children: options,
      value: null,
    };
    this.markParents(root);
    this.rootTree = root;
    this.renderedOptions = this.rootTree;
  }

  ngAfterViewInit() {
    /**
     * menuItems will change when the user navigates into or out of a submenu. when that happens, we want to
     * direct their focus to the first item in the new menu
     */
    this.menuItems.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.menu.keyManager.setFirstItemActive();
    });
  }

  /**
   * Calculate the width of the menu based on whichever is larger, the chip select width or the width of
   * the initially rendered options
   */
  protected setMenuWidth() {
    const chipWidth = this.chipSelectButton.nativeElement.getBoundingClientRect().width;

    const firstMenuItemWidth =
      this.menu.menuItems.first.elementRef.nativeElement.getBoundingClientRect().width;

    this.menuWidth = Math.max(chipWidth, firstMenuItemWidth);
  }

  /** Control Value Accessor */

  private notifyOnChange?: (value: T[]) => void;
  private notifyOnTouched?: () => void;

  /** Implemented as part of NG_VALUE_ACCESSOR */
  writeValue(obj: T[]): void {
    this.selectedOptions = this.findOptions(this.rootTree, obj);
    this.setOrResetRenderedOptions();
  }

  /** Implemented as part of NG_VALUE_ACCESSOR */
  registerOnChange(fn: (value: T[]) => void): void {
    this.notifyOnChange = fn;
  }

  /** Implemented as part of NG_VALUE_ACCESSOR */
  registerOnTouched(fn: any): void {
    this.notifyOnTouched = fn;
  }

  /** Implemented as part of NG_VALUE_ACCESSOR */
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  /** Implemented as part of NG_VALUE_ACCESSOR */
  protected onChange(option: Option<T>[] | null) {
    if (!this.notifyOnChange) {
      return;
    }

    this.notifyOnChange(option?.map((o) => o.value) ?? null);
  }

  /** Implemented as part of NG_VALUE_ACCESSOR */
  protected onBlur() {
    if (!this.notifyOnTouched) {
      return;
    }

    this.notifyOnTouched();
  }
}
