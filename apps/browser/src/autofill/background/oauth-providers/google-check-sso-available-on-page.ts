export type SuccessCheckSsoAvailableOnPageResult = {
  signInLink: HTMLAnchorElement | undefined;
  pageUrl: string;
  pageDomain: string;
  pageTitle: string;
};

export type FailureCheckSsoAvailableOnPageResult = {
  debug: string;
};

/**
 * Standalone function executed inside the page via chrome.scripting.executeScript.
 * Must be fully self-contained — no closures over outer variables.
 */
export function checkSsoAvailableOnPage():
  | SuccessCheckSsoAvailableOnPageResult
  | FailureCheckSsoAvailableOnPageResult {
  try {
    const signInLink = [...document.querySelectorAll("a")].find(
      (el) => el.textContent.trim().toLowerCase() === "sign in",
    );

    return {
      signInLink,
      pageUrl: location.href,
      pageDomain: location.hostname,
      pageTitle: document.title,
    };
  } catch (e) {
    return {
      debug: `checkSsoAvailableOnPage threw error: ${String(e)}`,
    };
  }
}
