// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// Set theme on page load
// This is done outside the Angular app to avoid a flash of unthemed content before it loads
const setTheme = () => {
  const getLegacyTheme = (): string | null => {
    // MANUAL-STATE-ACCESS: Calling global to get setting before migration
    // has had a chance to run, can be remove in the future.
    // Tracking Issue: https://bitwarden.atlassian.net/browse/PM-6676
    const globalState = window.localStorage.getItem("global");

    const parsedGlobalState = JSON.parse(globalState) as { theme?: string } | null;
    return parsedGlobalState ? parsedGlobalState.theme : null;
  };

  const defaultTheme = "light";
  const htmlEl = document.documentElement;
  let theme = defaultTheme;

  // First try the new state providers location, then the legacy location
  const themeFromState =
    window.localStorage.getItem("global_theming_selection") ?? getLegacyTheme();

  if (themeFromState) {
    if (themeFromState.indexOf("system") > -1) {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else if (themeFromState.indexOf("dark") > -1) {
      theme = "dark";
    }
  }

  if (!htmlEl.classList.contains("theme_" + theme)) {
    // The defaultTheme is also set in the html itself to make sure that some theming is always applied
    htmlEl.classList.remove("theme_" + defaultTheme);
    htmlEl.classList.add("theme_" + theme);
  }
};

setTheme();
