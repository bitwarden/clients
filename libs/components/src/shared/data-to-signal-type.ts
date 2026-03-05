import { Signal } from "@angular/core";

export type MappedDataToSignal<T> = {
  [Property in keyof T]: Signal<T[Property]>;
};
