/**
 * Set theme on page load based on (in order of priority):
 *  1. the user's preferred theme from the theme state provider
 *  2. the user's system theme
 *  3. default to light theme (theoretically should never happen, but we need some kind of default)
 *
 * This is done outside the Angular app to avoid a flash of unthemed content before it loads.
 */
const setTheme = () => {
  /**
   * If we cannot find a system preference or any other indication of what theme to apply,
   * then we will default to light. `theme_light` is hardcoded as the default in the web app's
   * index.html file.
   */
  const defaultTheme = "light";
  const htmlEl = document.documentElement;
  let theme = defaultTheme;

  const themeFromState = window.localStorage.getItem("global_theming_selection");

  if (themeFromState) {
    if (themeFromState.indexOf("system") > -1) {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else if (themeFromState.indexOf("dark") > -1) {
      theme = "dark";
    }
  } else {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  if (!htmlEl.classList.contains("theme_" + theme)) {
    htmlEl.classList.remove("theme_" + defaultTheme);
    htmlEl.classList.add("theme_" + theme);
  }
};

setTheme();
