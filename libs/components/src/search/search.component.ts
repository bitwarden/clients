// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, ElementRef, Input, ViewChild } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

import { isBrowserSafariApi } from "@bitwarden/platform";

import { FocusableElement } from "../shared/focusable-element";

let nextId = 0;

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
})
export class SearchComponent implements ControlValueAccessor, FocusableElement {
  private notifyOnChange: (v: string) => void;
  private notifyOnTouch: () => void;

  @ViewChild("input") private input: ElementRef<HTMLInputElement>;

  protected id = `search-id-${nextId++}`;
  protected searchText: string;
  // Use `type="text"` for Safari to improve rendering performance
  protected inputType = isBrowserSafariApi() ? ("text" as const) : ("search" as const);

  @Input() disabled: boolean;
  @Input() placeholder: string;

  getFocusTarget() {
    return this.input.nativeElement;
  }

  onChange(searchText: string) {
    if (this.notifyOnChange != undefined) {
      this.notifyOnChange(searchText);
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
    this.disabled = isDisabled;
  }
}
