import { MappedDataToSignal } from "../shared/data-to-signal-type";

export interface Option<T> {
  icon?: string;
  value: T | null;
  label?: string;
  disabled?: boolean;
}

export type MappedOptionComponent<T> = MappedDataToSignal<Option<T>>;
