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

const OBSERVED_IFRAME_ATTRIBUTES = ["src", "allow", "srcdoc"];

/**
 * Scrape the document's iframe `allow=` attributes and post them to the
 * background. Waits for `DOMContentLoaded` so dynamically-positioned static
 * iframes are present, then keeps observing the document so iframes inserted
 * later (e.g. by a single-page app opening an embedded sign-in dialog) and
 * changes to an iframe's `src` / `allow` / `srcdoc` are re-reported.
 *
 * Without the observer, a cross-origin iframe inserted after first paint is
 * never reported, the background finds no `allow=` for it, and the resolver
 * applies the container default (`self`), wrongly denying a ceremony that the
 * iframe's `allow=` attribute delegates.
 *
 * Each report carries the full current iframe list, so the background's
 * "newer report wins" cache stays accurate. Identical consecutive reports are
 * skipped. No message is sent while the document has never contained iframes,
 * which avoids runtime traffic on the vast majority of pages.
 *
 * @returns A function that stops observing the document.
 */
export function reportIframeAttributesWhenReady(doc: Document, send: SendReportFn): () => void {
  let lastReport: string | undefined;
  let observer: MutationObserver | undefined;
  let stopped = false;

  const report = () => {
    const iframes = scrapeIframeAllowAttributes(doc);
    if (iframes.length === 0 && lastReport === undefined) {
      return;
    }
    const serialized = JSON.stringify(iframes);
    if (serialized === lastReport) {
      return;
    }
    lastReport = serialized;
    send(PERMISSIONS_POLICY_REPORT_COMMAND, { iframes });
  };

  const start = () => {
    if (stopped) {
      return;
    }
    report();
    if (typeof MutationObserver !== "function") {
      return;
    }
    observer = new MutationObserver((records) => {
      if (records.some(isIframeMutation)) {
        report();
      }
    });
    observer.observe(doc, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: OBSERVED_IFRAME_ATTRIBUTES,
    });
  };

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  return () => {
    stopped = true;
    doc.removeEventListener("DOMContentLoaded", start);
    observer?.disconnect();
    observer = undefined;
  };
}

function isIframeMutation(record: MutationRecord): boolean {
  if (record.type === "attributes") {
    return isIframe(record.target);
  }
  return nodesContainIframe(record.addedNodes) || nodesContainIframe(record.removedNodes);
}

function nodesContainIframe(nodes: NodeList): boolean {
  for (const node of Array.from(nodes)) {
    if (isIframe(node)) {
      return true;
    }
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).querySelector("iframe") != null) {
      return true;
    }
  }
  return false;
}

function isIframe(node: Node): boolean {
  return node.nodeName === "IFRAME";
}
