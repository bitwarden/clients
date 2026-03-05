import { NgIf, NgClass } from "@angular/common";
import { Component, ElementRef, input, model, signal, computed, viewChild } from "@angular/core";
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

  private readonly input = viewChild<ElementRef<HTMLInputElement>>("input");

  protected id = `search-id-${nextId++}`;
  protected searchText?: string;
  // Use `type="text"` for Safari to improve rendering performance
  protected inputType = isBrowserSafariApi() ? ("text" as const) : ("search" as const);

  protected readonly isInputFocused = signal(false);
  protected readonly isFormHovered = signal(false);

  protected readonly showResetButton = computed(
    () => this.isInputFocused() || this.isFormHovered(),
  );

  readonly disabled = model<boolean>();
  readonly placeholder = input<string>();
  readonly autocomplete = input<string>();

  getFocusTarget() {
    return this.input()?.nativeElement;
  }

  onChange(searchText: string) {
    this.searchText = searchText; // update the model when the input changes (so we can use it with *ngIf in the template)
    if (this.notifyOnChange != undefined) {
      this.notifyOnChange(searchText);
    }
  }

  // Handle the reset button click
  clearSearch() {
    this.searchText = "";
    if (this.notifyOnChange) {
      this.notifyOnChange("");
    }
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
    this.searchText = searchText;
  }

  setDisabledState(isDisabled: boolean) {
    this.disabled.set(isDisabled);
  }
}
