////
// HEADLESS=1 hides the windows a run opens, HEADLESS=0 shows them. Unset keeps
// each runner's own default, because a debug launcher is normally watched while
// a browser Playwright owns is not.
////

const HEADLESS = "HEADLESS";

export function headlessMode(fallback: boolean): boolean {
  const value = process.env[HEADLESS];

  if (value === "1") {
    return true;
  }

  if (value === "0") {
    return false;
  }

  return fallback;
}
