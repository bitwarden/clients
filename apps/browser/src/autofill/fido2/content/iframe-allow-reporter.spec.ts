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

  it("exports the canonical command string for cross-context reuse", () => {
    expect(PERMISSIONS_POLICY_REPORT_COMMAND).toBe("permissionsPolicyReportFrameAttributes");
  });
});
