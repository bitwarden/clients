import { NgIf, NgClass } from "@angular/common";
import {
  Component,
  ElementRef,
  inject,
  input,
  model,
  signal,
  computed,
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

import { InputModule } from "../input/input.module";
import { FocusableElement } from "../shared/focusable-element";

import { SEARCH_CONSUMER } from "./search-consumer";

let nextId = 0;

/**
 * Do not nest Search components inside another `<form>`, as they already contain their own standalone `<form>` element for searching.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-search",
  templateUrl: "./search.component.html",
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
  imports: [InputModule, ReactiveFormsModule, FormsModule, I18nPipe, NgIf, NgClass],
})
export class SearchComponent implements ControlValueAccessor, FocusableElement {
  private notifyOnChange?: (v: string) => void;
  private notifyOnTouch?: () => void;

  /**
   * Optional ancestor that owns the search term (e.g. a table). When present,
   * the search two-way binds to it instead of behaving as a standalone control.
   */
  private readonly consumer = inject(SEARCH_CONSUMER, { optional: true });

  private readonly input = viewChild<ElementRef<HTMLInputElement>>("input");

  protected id = `search-id-${nextId++}`;
  /** Internal value used when there's no {@link consumer} (standalone / CVA use). */
  private readonly internalValue = signal<string>("");
  /** Displayed value: the consumer's term when present, otherwise the CVA value. */
  protected readonly searchText = computed(() =>
    this.consumer ? this.consumer.searchTerm() : this.internalValue(),
  );
  // Use `type="text"` for Safari to improve rendering performance
  protected inputType = isBrowserSafariApi() ? ("text" as const) : ("search" as const);

  protected readonly isInputFocused = signal(false);
  protected readonly isFormHovered = signal(false);
  protected readonly isResetButtonFocused = signal(false);

  protected readonly showResetButton = computed(
    () => this.isInputFocused() || this.isFormHovered() || this.isResetButtonFocused(),
  );

  readonly disabled = model<boolean>();
  readonly placeholder = input<string>();
  readonly autocomplete = input<string>();

  getFocusTarget() {
    return this.input()?.nativeElement;
  }

  onChange(searchText: string) {
    this.internalValue.set(searchText);
    this.consumer?.searchTerm.set(searchText);
    if (this.notifyOnChange != undefined) {
      this.notifyOnChange(searchText);
    }
  }

  // Handle the reset button click
  clearSearch() {
    this.internalValue.set("");
    this.consumer?.searchTerm.set("");
    if (this.notifyOnChange) {
      this.notifyOnChange("");
    }
    // Return focus to the search input since the reset button is about to be removed from the DOM
    this.input()?.nativeElement.focus();
  }

  onTouch() {
    if (this.notifyOnTouch != undefined) {
      this.notifyOnTouch();
    }
  }

  registerOnChange(fn: (v: string) => void): void {
    this.notifyOnChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.notifyOnTouch = fn;
  }

  writeValue(searchText: string): void {
    this.internalValue.set(searchText ?? "");
  }

  setDisabledState(isDisabled: boolean) {
    this.disabled.set(isDisabled);
  }
}
