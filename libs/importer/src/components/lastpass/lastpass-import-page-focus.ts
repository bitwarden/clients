import { InjectionToken } from "@angular/core";

/** Returns the user to the import page once the LastPass SSO tab has handed off its result. */
export interface LastPassImportPageFocus {
  /** Records the page to return to. Call before opening the SSO tab. */
  capture(): Promise<void>;

  /** Refocuses the captured page; does nothing if none was captured. */
  restore(): void;
}

export const LASTPASS_IMPORT_PAGE_FOCUS = new InjectionToken<LastPassImportPageFocus>(
  "LASTPASS_IMPORT_PAGE_FOCUS",
  {
    providedIn: "root",
    factory: () => ({
      capture: () => Promise.resolve(),
      restore: () => undefined,
    }),
  },
);
