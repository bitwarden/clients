/**
 * Standalone function injected into Google's account chooser page.
 * Attaches click listeners to account elements and sends the selected
 * email back to the extension via chrome.runtime.sendMessage.
 *
 * Must be fully self-contained — no closures over outer variables.
 */
export function googleAccountSelectionListener(): void {
  function extractEmailFromElement(el: Element): string | null {
    // Walk up from click target to find a clickable account container
    const ancestor =
      el.closest("[data-identifier]") ??
      el.closest("[data-email]") ??
      el.closest("[role='link']") ??
      el.closest("[data-authuser]") ??
      el.closest("li");

    if (!ancestor) {
      return null;
    }

    // 1. Check data attributes on the ancestor
    for (const attr of ["data-identifier", "data-email"]) {
      const val = ancestor.getAttribute(attr);
      if (val?.includes("@")) {
        return val;
      }
    }

    // 2. Check data attributes on child elements
    for (const attr of ["data-identifier", "data-email"]) {
      const child = ancestor.querySelector(`[${attr}]`);
      if (child) {
        const val = child.getAttribute(attr);
        if (val?.includes("@")) {
          return val;
        }
      }
    }

    // 3. Search child divs/spans for email-like text (GSI select page has
    //    no data attributes — email is only in text content of child elements)
    const children = ancestor.querySelectorAll("div, span");
    for (const child of children) {
      // Only check direct text, not nested children's text
      const text = child.textContent?.trim() ?? "";
      if (text.includes("@") && !text.includes(" ")) {
        const match = text.match(/^[\w.-]+@[\w.-]+\.\w+$/);
        if (match) {
          return match[0];
        }
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
