import { EmailScrapeResult } from "../abstractions/oauth-detection.background";

/**
 * Standalone function executed inside Facebook consent pages via
 * chrome.scripting.executeScript. Must be fully self-contained —
 * no closures over outer variables.
 *
 * Scrapes the user's name from the account navigation element
 * on Facebook's consent/permission pages.
 */
export function scrapeFacebookNameFromPage(): EmailScrapeResult {
  try {
    // The account controls navigation contains the user's name in a span.
    // Structure: <div role="navigation" aria-label="Account Controls and Settings">
    //   ... <span dir="auto">Stephen Vernyi</span>
    const nav = document.querySelector('[aria-label="Account Controls and Settings"]');
    if (nav) {
      const spans = nav.querySelectorAll('span[dir="auto"]');
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (text && text.length > 0) {
          return { email: text, debug: "found name via Account Controls navigation span" };
        }
      }
      return {
        email: null,
        debug: `Account Controls nav found but no span with text`,
      };
    }

    return {
      email: null,
      debug: `no Account Controls navigation element found`,
    };
  } catch (e) {
    return {
      email: null,
      debug: `scraper threw error: ${String(e)}`,
    };
  }
}
