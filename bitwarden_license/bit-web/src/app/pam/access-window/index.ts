/**
 * The window module's external surface. No components, no internals.
 *
 * `export *` here re-published the whole directory, so importing `composeAccessWindow` dragged
 * `@bitwarden/components` in behind it. The components are imported by path, as the rest of
 * `pam/` imports its own, and so is anything only this directory needs.
 */
export {
  type AccessWindowFormValue,
  type RequestWindowError,
  type RequestWindowProblem,
  EMPTY_ACCESS_WINDOW,
  REQUEST_WINDOW_ERROR_KEY,
  composeAccessWindow,
  defaultAccessWindow,
  toDateValue,
  toTimeValue,
} from "./access-window";
