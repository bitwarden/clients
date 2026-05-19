export abstract class RegistrationStartComponentService {
  /** Whether to show the page icon on the data entry screen. */
  abstract showDataEntryPageIcon: boolean;

  /** Whether the data entry screen should use the anon-layout adjusted layout (left-aligned, reduced padding) */
  abstract dataEntryAdjustedLayout: boolean;
}
