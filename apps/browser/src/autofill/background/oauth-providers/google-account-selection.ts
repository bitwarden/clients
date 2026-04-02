/**
 * Standalone function injected into Google's account chooser page.
 * Attaches click listeners to account elements and sends the selected
 * email back to the extension via chrome.runtime.sendMessage.
 *
 * Must be fully self-contained — no closures over outer variables.
 */
export function googleAccountSelectionListener(): void {
  function extractEmailFromElement(el: Element): string | null {
    // Google account chooser items have data-identifier with the email
    const identifier = el.closest("[data-identifier]");
    if (identifier) {
      const email = identifier.getAttribute("data-identifier");
      if (email?.includes("@")) {
        return email;
      }
    }

    // Walk up to find a container with data-email
    const emailEl = el.closest("[data-email]");
    if (emailEl) {
      const email = emailEl.getAttribute("data-email");
      if (email?.includes("@")) {
        return email;
      }
    }

    // Look for email-like text in sibling/child elements near the click
    const container = el.closest("[role='link'], [data-authuser], li, [jsname]");
    if (container) {
      const text = container.textContent ?? "";
      const match = text.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  // Use capture phase to intercept clicks before navigation
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element;
      if (!target) {
        return;
      }

      const email = extractEmailFromElement(target);
      if (email) {
        try {
          void chrome.runtime.sendMessage({
            command: "oauthAccountSelected",
            email,
          });
        } catch {
          // Extension context may be invalidated
        }
      }
    },
    true,
  );

  // Also watch for keyboard selection (Enter on focused account)
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter") {
        return;
      }
      const focused = document.activeElement;
      if (!focused) {
        return;
      }

      const email = extractEmailFromElement(focused);
      if (email) {
        try {
          void chrome.runtime.sendMessage({
            command: "oauthAccountSelected",
            email,
          });
        } catch {
          // Extension context may be invalidated
        }
      }
    },
    true,
  );
}
