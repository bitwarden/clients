import { hasModifierKey } from "@angular/cdk/keycodes";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from "@angular/core";
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  FormsModule,
} from "@angular/forms";

import { isBrowserSafariApi } from "@bitwarden/platform";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  BitFieldContainerDirective,
  FieldContainerSize,
} from "../form-field/field-container.directive";
import { IconComponent } from "../icon";
import { BitIconButtonComponent } from "../icon-button";
import { BitKbdComponent } from "../kbd";
import { FocusableElement } from "../shared/focusable-element";
import { injectKeyboardShortcut } from "../utils/keyboard-shortcut";

let nextId = 0;

/**
 * Do not nest Search components inside another `<form>`, as they already contain their own standalone `<form>` element for searching.
 */
@Component({
  selector: "bit-search",
  templateUrl: "./search.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: SearchComponent,
    },
    {
      provide: FocusableElement,
      useExisting: SearchComponent,
    },
  ],
  imports: [
    IconComponent,
    BitFieldContainerDirective,
    ReactiveFormsModule,
    FormsModule,
    I18nPipe,
    BitIconButtonComponent,
    BitKbdComponent,
  ],
})
export class SearchComponent implements ControlValueAccessor, FocusableElement {
  private readonly notifyOnChange = signal<((v: string) => void) | undefined>(undefined);
  private readonly notifyOnTouch = signal<(() => void) | undefined>(undefined);

  private readonly input = viewChild<ElementRef<HTMLInputElement>>("input");

  protected readonly id = `search-id-${nextId++}`;
  protected readonly searchText = signal<string | undefined>(undefined);

  /** The current search term, for hosts (e.g. `bit-table-v2`) that read it without owning the form control. */
  readonly value = this.searchText.asReadonly();
  // Use `type="text"` for Safari to improve rendering performance
  protected readonly inputType = isBrowserSafariApi() ? ("text" as const) : ("search" as const);

  readonly disabled = model<boolean>();
  readonly placeholder = input<string>();
  readonly autocomplete = input<string>();
  readonly size = input<FieldContainerSize>("base");

  /**
   * When true, enables the ⌘/Ctrl+F focus shortcut and shows shortcut hints. Esc clears the field
   * regardless. The shortcut is suppressed while a dialog is open, unless this search is inside
   * that dialog.
   *
   * Do not set this on desktop: it ships a native `CmdOrCtrl+F` menu accelerator
   * (`apps/desktop/src/main/menu/menu.view.ts`) that already focuses the vault search, and opting in
   * would install a second handler for the same chord.
   */
  readonly useKeyShortcuts = input<boolean>(false);

  constructor() {
    injectKeyboardShortcut({
      key: "f",
      code: "KeyF",
      enabled: () => this.useKeyShortcuts() && !this.disabled(),
      // Focus and select, matching desktop's native accelerator, so a second press replaces the
      // term. `select()` is not specified to focus, so both calls are needed.
      handler: () => {
        const el = this.input()?.nativeElement;
        el?.focus();
        el?.select();
      },
    });
  }

  getFocusTarget() {
    return this.input()?.nativeElement;
  }

  onChange(searchText: string) {
    this.searchText.set(searchText);
    this.notifyOnChange()?.(searchText);
  }

  // Safari uses type="text", losing the native clear. Stopping propagation keeps Escape one
  // action: an enclosing overlay only closes on a second press, once there's nothing left to clear.
  protected handleInputKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || hasModifierKey(event) || !this.searchText()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.clearSearch();
  }

  // Handle the reset button click
  clearSearch() {
    this.searchText.set("");
    this.notifyOnChange()?.("");
    // Return focus to the search input since the reset button is about to be removed from the DOM
    this.input()?.nativeElement.focus();
  }

  onTouch() {
    this.notifyOnTouch()?.();
  }

  registerOnChange(fn: (v: string) => void): void {
    this.notifyOnChange.set(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.notifyOnTouch.set(fn);
  }

  writeValue(searchText: string): void {
    this.searchText.set(searchText);
  }

  setDisabledState(isDisabled: boolean) {
    this.disabled.set(isDisabled);
  }
}
