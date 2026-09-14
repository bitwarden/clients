import { IframeAllowAttribute, scrapeIframeAllowAttributes } from "./iframe-allow-scraper";

/**
 * Background-bound command for reporting scraped iframe `allow=` attributes.
 * Imported by the background-side orchestrator to keep the contract in one place.
 */
export const PERMISSIONS_POLICY_REPORT_COMMAND = "permissionsPolicyReportFrameAttributes";

/**
 * Send function shape. Matches `sendExtensionMessage(command, options)` from
 * `apps/browser/src/autofill/utils`; declared narrowly here so the reporter
 * doesn't have a hard dependency on that module's full surface.
 */
export type SendReportFn = (
  command: string,
  payload: { iframes: IframeAllowAttribute[] },
) => unknown;

/**
 * Scrape the document's iframe `allow=` attributes and post them to the
 * background. Waits for `DOMContentLoaded` so dynamically-positioned static
 * iframes are present.
 *
 * Does **not** observe later iframe additions or attribute mutations — those
 * are a deferred enhancement. The current scope captures static iframes
 * present at first paint, which is the common shape for delegated WebAuthn
 * embedding (the parent declares the iframe at page load with its `allow=`
 * attribute baked into the HTML).
 *
 * No-op when the document has no iframes — avoids sending empty messages
 * across the runtime boundary on the vast majority of pages.
 */
export function reportIframeAttributesWhenReady(doc: Document, send: SendReportFn): void {
  const report = () => {
    const iframes = scrapeIframeAllowAttributes(doc);
    if (iframes.length === 0) {
      return;
    }
    send(PERMISSIONS_POLICY_REPORT_COMMAND, { iframes });
  };

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", report, { once: true });
    return;
  }
  report();
}
