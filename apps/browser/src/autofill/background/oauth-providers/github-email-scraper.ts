import { EmailScrapeResult } from "../abstractions/oauth-detection.background";

/**
 * Standalone function executed inside the GitHub OAuth consent page via
 * chrome.scripting.executeScript. Must be fully self-contained —
 * no closures over outer variables.
 */
export function scrapeGitHubUsernameFromPage(): EmailScrapeResult {
  try {
    // Strategy 1: Avatar image alt attribute (e.g. alt="@svengeance")
    const avatarImg = document.querySelector("img.avatar-user[alt]");
    if (avatarImg) {
      const alt = avatarImg.getAttribute("alt") ?? "";
      if (alt.startsWith("@") && alt.length > 1) {
        return { email: alt.slice(1), debug: "found via avatar img alt attribute" };
      }
    }

    // Strategy 2: "wants to access your <strong>username</strong> account" text
    const smallEls = document.querySelectorAll("small");
    for (const el of smallEls) {
      const text = el.textContent ?? "";
      if (text.includes("wants to access your") && text.includes("account")) {
        const strong = el.querySelector("strong");
        if (strong) {
          const username = strong.textContent?.trim();
          if (username) {
            return { email: username, debug: "found via 'wants to access your' strong element" };
          }
        }
      }
    }

    // Strategy 3: data-login attribute (sometimes present on user elements)
    const loginEl = document.querySelector("[data-login]");
    if (loginEl) {
      const val = loginEl.getAttribute("data-login");
      if (val) {
        return { email: val, debug: "found via data-login attribute" };
      }
    }

    return {
      email: null,
      debug: `no username found in page (${document.body?.innerText?.length ?? 0} chars)`,
    };
  } catch (e) {
    return {
      email: null,
      debug: `scraper threw error: ${String(e)}`,
    };
  }
}
