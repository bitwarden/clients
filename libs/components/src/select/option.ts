import { Signal } from "@angular/core";

export interface Option<T> {
  icon?: Signal<string>;
  value: Signal<T | null>;
  label?: Signal<string>;
  disabled?: Signal<boolean>;
}
