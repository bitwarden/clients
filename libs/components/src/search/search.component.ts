import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
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
import { KbdDirective } from "../kbd";
import { FocusableElement } from "../shared/focusable-element";
import { injectModifierKey } from "../utils";

let nextId = 0;

/**
 * Do not nest Search components inside another `<form>`, as they already contain their own standalone `<form>` element for searching.
 */
@Component({
  selector: "bit-search",
  templateUrl: "./search.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:keydown)": "handleDocumentShortcut($event)",
  },
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
    KbdDirective,
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

  /** When true, shows ⌘/Ctrl+F and Esc shortcut hints and hijacks Cmd/Ctrl+F to focus. */
  readonly showShortcutHints = input<boolean>(false);

  /** Platform-aware modifier key label; "Command" on Mac, "Ctrl" elsewhere. */
  protected readonly modifierKey = injectModifierKey();

  /** Maps "Command" → "⌘", "Ctrl" → "Ctrl" for the template badge. */
  protected readonly modifierGlyph = computed(() =>
    this.modifierKey() === "Command" ? "⌘" : "Ctrl",
  );

  getFocusTarget() {
    return this.input()?.nativeElement;
  }

  onChange(searchText: string) {
    this.searchText.set(searchText);
    this.notifyOnChange()?.(searchText);
  }

  protected handleDocumentShortcut(event: KeyboardEvent): void {
    if (!this.showShortcutHints()) {
      return;
    }

    // Cmd+F (Mac) or Ctrl+F (Win/Linux) — exactly one of metaKey/ctrlKey
    if (event.key.toLowerCase() !== "f" || event.metaKey === event.ctrlKey) {
      return;
    }

    event.preventDefault();
    this.input()?.nativeElement.focus();
  }

  // Safari uses type="text" so Escape won't natively clear the field; handle it manually.
  protected handleInputKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.searchText()) {
      event.preventDefault();
      this.clearSearch();
    }
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
