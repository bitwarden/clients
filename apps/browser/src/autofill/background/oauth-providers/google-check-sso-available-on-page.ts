/**
 * Standalone function executed inside the page via chrome.scripting.executeScript.
 * Must be fully self-contained — no closures over outer variables.
 */
export function checkSsoAvailableOnPage(): any {
  try {
    const element = document.querySelector(".signin-container");

    const hasGoogleScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]',
    );

    const signInLink = [...document.querySelectorAll("a")].find(
      (el) => el.textContent.trim().toLowerCase() === "sign in",
    );

    return {
      available: true,
      element,
      signInLink,
      hasGoogleScript,
      pageUrl: location.href,
      pageDomain: location.hostname,
      pageTitle: document.title,
      debug: "We found it",
    };
  } catch (e) {
    return {
      available: false,
      debug: `scraper threw error: ${String(e)}`,
    };
  }
}
