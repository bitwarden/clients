import { MappedDataToSignal } from "../shared/data-to-signal-type";
import { BitwardenIcon } from "../shared/icon";

export interface Option<T> {
  icon?: BitwardenIcon;
  value: T | null;
  label?: string;
  description?: string;
  metaData?: string;
  disabled?: boolean;
}

export type MappedOptionComponent<T> = MappedDataToSignal<Option<T>>;
