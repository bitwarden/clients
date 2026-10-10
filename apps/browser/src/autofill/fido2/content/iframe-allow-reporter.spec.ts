import {
  PERMISSIONS_POLICY_REPORT_COMMAND,
  reportIframeAttributesWhenReady,
} from "./iframe-allow-reporter";

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("reportIframeAttributesWhenReady", () => {
  it("does not call send when the document has no iframes", () => {
    const doc = makeDoc("<html><body><div></div></body></html>");
    const send = jest.fn();

    reportIframeAttributesWhenReady(doc, send);

    expect(send).not.toHaveBeenCalled();
  });

  it("posts the scraped iframes under the expected command when iframes are present", () => {
    const doc = makeDoc(`
      <html><body>
        <iframe src="https://child.example/" allow="publickey-credentials-get"></iframe>
      </body></html>
    `);
    const send = jest.fn();

    reportIframeAttributesWhenReady(doc, send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(PERMISSIONS_POLICY_REPORT_COMMAND, {
      iframes: [
        {
          src: "https://child.example/",
          allow: "publickey-credentials-get",
          srcdoc: false,
        },
      ],
    });
  });

  it("reports immediately when readyState is already past 'loading'", () => {
    const doc = makeDoc(`
      <html><body>
        <iframe src="https://a.example/" allow="x"></iframe>
      </body></html>
    `);
    // jsdom's DOMParser yields a Document that's already 'complete', so the
    // synchronous path is what runs here.
    const send = jest.fn();

    reportIframeAttributesWhenReady(doc, send);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("defers until DOMContentLoaded when the document is still loading", () => {
    const doc = makeDoc(`
      <html><body>
        <iframe src="https://a.example/" allow="x"></iframe>
      </body></html>
    `);
    Object.defineProperty(doc, "readyState", { configurable: true, value: "loading" });
    const send = jest.fn();

    reportIframeAttributesWhenReady(doc, send);

    expect(send).not.toHaveBeenCalled();

    doc.dispatchEvent(new Event("DOMContentLoaded"));

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("only fires once even if DOMContentLoaded somehow re-fires", () => {
    const doc = makeDoc(`
      <html><body>
        <iframe src="https://a.example/" allow="x"></iframe>
      </body></html>
    `);
    Object.defineProperty(doc, "readyState", { configurable: true, value: "loading" });
    const send = jest.fn();

    reportIframeAttributesWhenReady(doc, send);
    doc.dispatchEvent(new Event("DOMContentLoaded"));
    doc.dispatchEvent(new Event("DOMContentLoaded"));

    expect(send).toHaveBeenCalledTimes(1);
  });

  describe("iframes changed after the initial scrape", () => {
    // MutationObserver delivers records in a microtask queued at mutation time,
    // so awaiting one resolved promise lets the observer callback run.
    const flushMutationObserver = () => Promise.resolve();

    function appendIframe(doc: Document, src: string, allow: string): HTMLIFrameElement {
      const iframe = doc.createElement("iframe");
      iframe.setAttribute("allow", allow);
      iframe.setAttribute("src", src);
      doc.body.appendChild(iframe);
      return iframe;
    }

    it("reports a cross-origin iframe inserted after the initial scrape", async () => {
      const doc = makeDoc("<html><body><div></div></body></html>");
      const send = jest.fn();

      reportIframeAttributesWhenReady(doc, send);
      appendIframe(doc, "https://money.example/challenge", "publickey-credentials-get");
      await flushMutationObserver();

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(PERMISSIONS_POLICY_REPORT_COMMAND, {
        iframes: [
          {
            src: "https://money.example/challenge",
            allow: "publickey-credentials-get",
            srcdoc: false,
          },
        ],
      });
    });

    it("reports an iframe nested inside an inserted container", async () => {
      const doc = makeDoc("<html><body></body></html>");
      const send = jest.fn();

      reportIframeAttributesWhenReady(doc, send);
      const dialog = doc.createElement("div");
      dialog.innerHTML =
        '<section><iframe src="https://money.example/" allow="publickey-credentials-get"></iframe></section>';
      doc.body.appendChild(dialog);
      await flushMutationObserver();

      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0][1].iframes).toEqual([
        { src: "https://money.example/", allow: "publickey-credentials-get", srcdoc: false },
      ]);
    });

    it("re-reports when an existing iframe's allow attribute changes", async () => {
      const doc = makeDoc(`
        <html><body>
          <iframe src="https://child.example/" allow="camera"></iframe>
        </body></html>
      `);
      const send = jest.fn();

      reportIframeAttributesWhenReady(doc, send);
      doc.querySelector("iframe")!.setAttribute("allow", "camera; publickey-credentials-get");
      await flushMutationObserver();

      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1][1].iframes).toEqual([
        {
          src: "https://child.example/",
          allow: "camera; publickey-credentials-get",
          srcdoc: false,
        },
      ]);
    });

    it("sends an empty report when the last reported iframe is removed", async () => {
      const doc = makeDoc(`
        <html><body>
          <iframe src="https://child.example/" allow="publickey-credentials-get"></iframe>
        </body></html>
      `);
      const send = jest.fn();

      reportIframeAttributesWhenReady(doc, send);
      doc.querySelector("iframe")!.remove();
      await flushMutationObserver();

      expect(send).toHaveBeenCalledTimes(2);
      expect(send).toHaveBeenLastCalledWith(PERMISSIONS_POLICY_REPORT_COMMAND, { iframes: [] });
    });

    it("ignores mutations that do not involve iframes", async () => {
      const doc = makeDoc(`
        <html><body>
          <iframe src="https://child.example/" allow="publickey-credentials-get"></iframe>
        </body></html>
      `);
      const send = jest.fn();

      reportIframeAttributesWhenReady(doc, send);
      doc.body.appendChild(doc.createElement("div"));
      doc.body.setAttribute("allow", "ignored");
      await flushMutationObserver();

      expect(send).toHaveBeenCalledTimes(1);
    });

    it("does not resend an unchanged iframe list", async () => {
      const doc = makeDoc(`
        <html><body>
          <iframe src="https://child.example/" allow="publickey-credentials-get"></iframe>
        </body></html>
      `);
      const send = jest.fn();

      reportIframeAttributesWhenReady(doc, send);
      doc.querySelector("iframe")!.setAttribute("allow", "publickey-credentials-get");
      await flushMutationObserver();

      expect(send).toHaveBeenCalledTimes(1);
    });

    it("stops reporting after the returned stop function is called", async () => {
      const doc = makeDoc("<html><body></body></html>");
      const send = jest.fn();

      const stop = reportIframeAttributesWhenReady(doc, send);
      stop();
      appendIframe(doc, "https://money.example/", "publickey-credentials-get");
      await flushMutationObserver();

      expect(send).not.toHaveBeenCalled();
    });

    it("does not start observing if stopped before DOMContentLoaded", async () => {
      const doc = makeDoc("<html><body></body></html>");
      Object.defineProperty(doc, "readyState", { configurable: true, value: "loading" });
      const send = jest.fn();

      const stop = reportIframeAttributesWhenReady(doc, send);
      stop();
      doc.dispatchEvent(new Event("DOMContentLoaded"));
      appendIframe(doc, "https://money.example/", "publickey-credentials-get");
      await flushMutationObserver();

      expect(send).not.toHaveBeenCalled();
    });
  });

  it("exports the canonical command string for cross-context reuse", () => {
    expect(PERMISSIONS_POLICY_REPORT_COMMAND).toBe("permissionsPolicyReportFrameAttributes");
  });
});
