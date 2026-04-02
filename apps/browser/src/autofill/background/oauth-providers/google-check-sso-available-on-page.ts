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
    const signInTerms = new Set([
      // English
      "sign in",
      "log in",
      "login",
      "signin",
      "sign-in",
      "log-in",
      "sign in with google",
      "continue with google",
      "log in with google",
      "log into your account",
      "sign into your account",
      "access your account",
      "member login",
      "member sign in",
      "user login",
      "account login",
      "already have an account? sign in",
      "already have an account? log in",
      "have an account? sign in",
      "have an account? log in",
      // Site-specific common phrasing
      "log in to reddit",
      "log in to facebook",
      "log in to twitter",
      "sign in to github",
      "sign in to microsoft",
      "sign in to your account",
      "log in to your account",
    ]);

    const signInLink = [...document.querySelectorAll("a")].find((el) =>
      signInTerms.has(el.textContent.trim().toLowerCase()),
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
