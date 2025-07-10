export interface Option<T> {
  icon?: string;
  value: T | null;
  label?: string;
  disabled?: boolean;
}
