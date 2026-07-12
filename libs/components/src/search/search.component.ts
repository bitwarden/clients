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
import { FocusableElement } from "../shared/focusable-element";

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
  ],
})
export class SearchComponent implements ControlValueAccessor, FocusableElement {
  private readonly notifyOnChange = signal<((v: string) => void) | undefined>(undefined);
  private readonly notifyOnTouch = signal<(() => void) | undefined>(undefined);

  private readonly input = viewChild<ElementRef<HTMLInputElement>>("input");

  protected readonly id = `search-id-${nextId++}`;
  protected readonly searchText = signal<string | undefined>(undefined);
  // Use `type="text"` for Safari to improve rendering performance
  protected readonly inputType = isBrowserSafariApi() ? ("text" as const) : ("search" as const);

  readonly disabled = model<boolean>();
  readonly placeholder = input<string>();
  readonly autocomplete = input<string>();
  readonly size = input<FieldContainerSize>("base");

  getFocusTarget() {
    return this.input()?.nativeElement;
  }

  onChange(searchText: string) {
    this.searchText.set(searchText);
    this.notifyOnChange()?.(searchText);
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
