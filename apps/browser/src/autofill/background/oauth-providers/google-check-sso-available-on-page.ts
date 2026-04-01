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

    return {
      available: true,
      element,
      hasGoogleScript,
      debug: "We found it",
    };
  } catch (e) {
    return {
      available: false,
      debug: `scraper threw error: ${String(e)}`,
    };
  }
}
