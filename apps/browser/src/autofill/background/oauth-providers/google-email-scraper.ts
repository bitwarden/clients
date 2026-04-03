import { EmailScrapeResult } from "../abstractions/oauth-detection.background";

/**
 * Standalone function executed inside the Google consent page via
 * chrome.scripting.executeScript. Must be fully self-contained —
 * no closures over outer variables.
 */
export function scrapeGoogleEmailFromPage(): EmailScrapeResult {
  try {
    // Strategy 1: data-profile-identifier attribute (consent pages)
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
    }

    // Strategy 2: data-identifier attribute (account chooser)
    const identifierEl = document.querySelector("[data-identifier]");
    if (identifierEl) {
      const val = identifierEl.getAttribute("data-identifier");
      if (val?.includes("@")) {
        return { email: val, debug: "found via data-identifier attr" };
      }
    }

    // Strategy 3: data-email attribute (GSI select child elements)
    const emailAttrEl = document.querySelector("[data-email]");
    if (emailAttrEl) {
      const val = emailAttrEl.getAttribute("data-email");
      if (val?.includes("@")) {
        return { email: val, debug: "found via data-email attr" };
      }
    }

    // Strategy 4: regex on body text
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
      debug: `no email found in page (${bodyText.length} chars)`,
    };
  } catch (e) {
    return {
      email: null,
      debug: `scraper threw error: ${String(e)}`,
    };
  }
}
