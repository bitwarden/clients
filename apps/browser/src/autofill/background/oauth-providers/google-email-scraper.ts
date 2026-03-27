import { EmailScrapeResult } from "../abstractions/oauth-detection.background";

/**
 * Standalone function executed inside the Google consent page via
 * chrome.scripting.executeScript. Must be fully self-contained —
 * no closures over outer variables.
 */
export function scrapeGoogleEmailFromPage(): EmailScrapeResult {
  try {
    // Primary: data-profile-identifier attribute
    const profileEl = document.querySelector("[data-profile-identifier]");
    if (profileEl) {
      const attrValue = profileEl.getAttribute("data-profile-identifier");
      if (attrValue) {
        return { email: attrValue, debug: "found via data-profile-identifier attr" };
      }
      const text = profileEl.textContent?.trim() ?? "";
      if (text.includes("@")) {
        return { email: text, debug: "found via data-profile-identifier textContent" };
      }
      return {
        email: null,
        debug: `[data-profile-identifier] element found but no email (attr="${attrValue}", text="${text}")`,
      };
    }

    // Last resort: look for any element containing an email-like string
    const bodyText = document.body?.innerText ?? "";
    const emailMatch = bodyText.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      return {
        email: emailMatch[0],
        debug: `found email via body text regex match`,
      };
    }

    return {
      email: null,
      debug: `no [data-profile-identifier], no email in body (${bodyText.length} chars)`,
    };
  } catch (e) {
    return {
      email: null,
      debug: `scraper threw error: ${String(e)}`,
    };
  }
}
