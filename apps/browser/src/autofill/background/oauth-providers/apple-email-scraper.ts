import { EmailScrapeResult } from "../abstractions/oauth-detection.background";

/**
 * Standalone function executed inside the Apple sign-in consent page via
 * chrome.scripting.executeScript. Must be fully self-contained —
 * no closures over outer variables.
 */
export function scrapeAppleEmailFromPage(): EmailScrapeResult {
  try {
    // Primary: Apple shows "continue using X with your Apple Account "email@example.com""
    // in a .profile__description element
    const profileEl = document.querySelector(".profile__description");
    if (profileEl) {
      const text = profileEl.textContent ?? "";
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        return { email: emailMatch[0], debug: "found via .profile__description text" };
      }
      return {
        email: null,
        debug: `.profile__description found but no email in text (${text.length} chars)`,
      };
    }

    // Fallback: search entire body for email pattern
    const bodyText = document.body?.innerText ?? "";
    const emailMatch = bodyText.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      return { email: emailMatch[0], debug: "found email via body text regex match" };
    }

    return {
      email: null,
      debug: `no .profile__description, no email in body (${bodyText.length} chars)`,
    };
  } catch (e) {
    return {
      email: null,
      debug: `scraper threw error: ${String(e)}`,
    };
  }
}
