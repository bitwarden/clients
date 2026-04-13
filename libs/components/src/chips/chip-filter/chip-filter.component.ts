// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  effect,
  signal,
  input,
  viewChild,
  viewChildren,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

import { compareValues } from "@bitwarden/common/platform/misc/compare-values";
import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonModule } from "../../button";
import { IconComponent } from "../../icon";
import { IconButtonModule } from "../../icon-button";
import { MenuComponent, MenuItemComponent, MenuModule, MenuTriggerForDirective } from "../../menu";
import { Option } from "../../select/option";
import { BitwardenIcon } from "../../shared/icon";
import { TypographyModule } from "../../typography";
import { BaseChipDirective } from "../shared/base-chip.directive";
import { ChipContentComponent } from "../shared/chip-content.component";
import { ChipDismissButtonComponent } from "../shared/chip-dismiss-button.component";

/** An option that will be showed in the overlay menu of `ChipFilterComponent` */
export type ChipFilterOption<T> = Omit<Option<T>, "icon"> & {
  /** The options that will be nested under this option */
  children?: ChipFilterOption<T>[];
  icon?: BitwardenIcon;
  iconClass?: string;
};

/**
 * `<bit-chip-filter>` is a select element that is commonly used to filter items in lists or tables.
 */
@Component({
  selector: "bit-chip-filter",
  templateUrl: "chip-filter.component.html",
  imports: [
    CommonModule,
    I18nPipe,
    ButtonModule,
    IconButtonModule,
    MenuModule,
    TypographyModule,
    ChipContentComponent,
    ChipDismissButtonComponent,
    IconComponent,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: ChipFilterComponent,
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "classList()",
  },
  hostDirectives: [
    {
      directive: BaseChipDirective,
      inputs: ["maxWidthClass", "fullWidth"],
    },
  ],
})
export class ChipFilterComponent<T = unknown> implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);
  readonly baseChip = inject(BaseChipDirective, { host: true });

  readonly menu = viewChild(MenuComponent);
  readonly menuItems = viewChildren(MenuItemComponent);
  readonly chipSelectButton = viewChild<ElementRef<HTMLButtonElement>>("chipSelectButton");
  readonly menuTrigger = viewChild(MenuTriggerForDirective);

  /** Text to show when there is no selected option */
  readonly placeholderText = input.required<string>();

  /** Icon to show when there is no selected option or the selected option does not have an icon */
  readonly placeholderIcon = input<BitwardenIcon>();

  /** The select options to render */
  readonly options = input.required<ChipFilterOption<T>[]>();

  /** Disables the entire chip (template input) */
  protected readonly disabledInput = input(false, {
    alias: "disabled",
    transform: booleanAttribute,
  });

  /** Disables the entire chip (programmatic control from CVA) */
  private readonly disabledState = signal(false);

  /** Combined disabled state from both input and programmatic control */
  readonly disabled = computed(() => this.disabledInput() || this.disabledState());

  /** Computed class list for host element based on fullWidth state */
  protected readonly classList = computed(() => {
    const baseClasses = "!tw-ps-0 !tw-pb-0";
    const widthClasses = this.baseChip.fullWidth() ? "tw-block tw-w-full" : "tw-inline-block";
    return `${baseClasses} ${widthClasses}`;
  });

  /** Tree constructed from `this.options` */
  private rootTree?: ChipFilterOption<T> | null;

  /** Store the pending value when writeValue is called before options are initialized */
  private pendingValue?: T;

  constructor() {
    this.baseChip.variant.set("subtle");
    this.baseChip.hasTrailingIcon.set(true);

    // Sync component's disabled state to BaseChipDirective
    effect(() => {
      this.baseChip.disabledState.set(this.disabled());
    });

    // Initialize the root tree whenever options change
    effect(() => {
      const currentSelection = this.selectedOption;

      // when the options change, clear the childParentMap
      this.childParentMap.clear();

      this.initializeRootTree(this.options());

      // when the options change, we need to change our selectedOption
      // to reflect the changed options.
      if (currentSelection?.value != null) {
        this.selectedOption = this.findOption(this.rootTree, currentSelection.value);
      }

      // If there's a pending value, apply it now that options are available
      if (this.pendingValue !== undefined) {
        this.selectedOption = this.findOption(this.rootTree, this.pendingValue);
        this.setOrResetRenderedOptions();
        this.pendingValue = undefined;
        this.cdr.markForCheck();
      }

      // Update selected state based on whether an option is selected
      this.baseChip.selectedState.set(!!this.selectedOption);
    });

    // Focus the first menu item when menuItems change (e.g., navigating submenus)
    effect(() => {
      // Trigger effect when menuItems changes
      const items = this.menuItems();
      const currentMenu = this.menu();
      const trigger = this.menuTrigger();
      // Note: `isOpen` is intentionally accessed outside signal tracking (via `trigger?.isOpen`)
      // to avoid re-focusing when the menu state changes. We only want to focus during
      // submenu navigation, not on initial open/close.
      if (items.length > 0 && trigger?.isOpen) {
        currentMenu?.keyManager?.setFirstItemActive();
      }
    });
  }

  /** Options that are currently displayed in the menu */
  protected renderedOptions?: ChipFilterOption<T> | null;

  /** The option that is currently selected by the user */
  protected selectedOption?: ChipFilterOption<T> | null;

  /**
   * The initial calculated width of the menu when it opens, which is used to
   * keep the width consistent as the user navigates through submenus
   */
  protected menuWidth: number | null = null;

  /** The label to show in the chip button */
  protected get label(): string {
    return this.selectedOption?.label || this.placeholderText();
  }

  /** The icon to show in the chip button */
  protected get icon(): BitwardenIcon | undefined {
    return this.selectedOption?.icon || this.placeholderIcon();
  }

  /**
   * Set the rendered options based on whether or not an option is already selected, so that the correct
   * submenu displays.
   */
  protected setOrResetRenderedOptions(): void {
    this.renderedOptions = this.selectedOption
      ? (this.selectedOption.children?.length ?? 0) > 0
        ? this.selectedOption
        : this.getParent(this.selectedOption)
      : this.rootTree;
  }

  protected handleMenuClosed(): void {
    this.setOrResetRenderedOptions();
    // reset menu width so that it can be recalculated upon open
    this.menuWidth = null;
  }

  protected selectOption(option: ChipFilterOption<T>, _event: MouseEvent) {
    this.selectedOption = option;
    this.baseChip.selectedState.set(true);
    this.onChange(option);
  }

  protected viewOption(option: ChipFilterOption<T>, event: MouseEvent) {
    this.renderedOptions = option;

    /** We don't want the menu to close */
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  /** Click handler for the X button */
  protected clear() {
    this.renderedOptions = this.rootTree;
    this.selectedOption = null;
    this.baseChip.selectedState.set(false);
    this.onChange(null);
  }

  /**
   * Find a `ChipFilterOption` by its value
   * @param tree the root tree to search
   * @param value the option value to look for
   * @returns the `ChipFilterOption` associated with the provided value, or null if not found
   */
  private findOption(
    tree: ChipFilterOption<T> | null | undefined,
    value: T,
  ): ChipFilterOption<T> | null {
    if (!tree) {
      return null;
    }

    let result = null;
    if (tree.value !== null && compareValues(tree.value, value)) {
      return tree;
    }

    if (Array.isArray(tree.children) && tree.children.length > 0) {
      tree.children.some((node) => {
        result = this.findOption(node, value);
        return result;
      });
    }
    return result;
  }

  /** Maps child options to their parent, to enable navigating up the tree */
  private childParentMap = new Map<ChipFilterOption<T>, ChipFilterOption<T>>();

  /** For each descendant in the provided `tree`, update `_parent` to be a reference to the parent node. This allows us to navigate back in the menu. */
  private markParents(tree: ChipFilterOption<T>) {
    tree.children?.forEach((child) => {
      this.childParentMap.set(child, tree);
      this.markParents(child);
    });
  }

  protected getParent(option: ChipFilterOption<T>): ChipFilterOption<T> | null | undefined {
    return this.childParentMap.get(option);
  }

  private initializeRootTree(options: ChipFilterOption<T>[]) {
    /** Since the component is just initialized with an array of options, we need to construct the root tree. */
    const root: ChipFilterOption<T> = {
      children: options,
      value: null,
    };
    this.markParents(root);
    this.rootTree = root;
    this.renderedOptions = this.rootTree;
  }

  /**
   * Calculate the width of the menu based on whichever is larger, the chip select width or the width of
   * the initially rendered options
   */
  protected setMenuWidth() {
    const chipWidth = this.chipSelectButton()?.nativeElement?.getBoundingClientRect()?.width ?? 0;

    const firstMenuItemWidth =
      this.menu()?.menuItems().at(0)?.elementRef?.nativeElement?.getBoundingClientRect()?.width ??
      0;

    this.menuWidth = Math.max(chipWidth, firstMenuItemWidth);
  }

  /** Control Value Accessor */

  private notifyOnChange?: (value: T | null) => void;
  private notifyOnTouched?: () => void;

  /** Implemented as part of NG_VALUE_ACCESSOR */
  writeValue(obj: T): void {
    // If rootTree is not yet initialized, store the value to apply it later
    if (!this.rootTree) {
      this.pendingValue = obj;
      return;
    }

    this.selectedOption = this.findOption(this.rootTree, obj);
    this.baseChip.selectedState.set(!!this.selectedOption);
    this.setOrResetRenderedOptions();
    // OnPush components require manual change detection when writeValue() is called
    // externally by Angular forms, as the framework doesn't automatically trigger CD
    this.cdr.markForCheck();
  }

  /** Implemented as part of NG_VALUE_ACCESSOR */
  registerOnChange(fn: (value: T | null) => void): void {
    this.notifyOnChange = fn;
  }

  /** Implemented as part of NG_VALUE_ACCESSOR */
  registerOnTouched(fn: any): void {
    this.notifyOnTouched = fn;
  }

  /** Implemented as part of NG_VALUE_ACCESSOR */
  setDisabledState(isDisabled: boolean): void {
    this.disabledState.set(isDisabled);
  }

  /** Implemented as part of NG_VALUE_ACCESSOR */
  protected onChange(option: ChipFilterOption<T> | null) {
    if (!this.notifyOnChange) {
      return;
    }

    this.notifyOnChange(option?.value ?? null);
  }

  /** Implemented as part of NG_VALUE_ACCESSOR */
  protected onBlur() {
    if (!this.notifyOnTouched) {
      return;
    }

    this.notifyOnTouched();
  }
}
