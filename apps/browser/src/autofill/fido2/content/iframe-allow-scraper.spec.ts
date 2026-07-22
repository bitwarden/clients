import { scrapeIframeAllowAttributes } from "./iframe-allow-scraper";

function makeDoc(html: string): Document {
  // jsdom's DOMParser produces a fresh Document we can inspect without
  // touching the global one.
  return new DOMParser().parseFromString(html, "text/html");
}

describe("scrapeIframeAllowAttributes", () => {
  it("returns an empty array when the document has no iframes", () => {
    const doc = makeDoc("<html><body><div>no iframes here</div></body></html>");

    expect(scrapeIframeAllowAttributes(doc)).toEqual([]);
  });

  it("captures an iframe's src and allow attributes", () => {
    const doc = makeDoc(`
      <html><body>
        <iframe src="https://child.example/foo" allow="publickey-credentials-get"></iframe>
      </body></html>
    `);

    const result = scrapeIframeAllowAttributes(doc);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      src: "https://child.example/foo",
      allow: "publickey-credentials-get",
      srcdoc: false,
    });
  });

  it("represents a missing allow attribute as an empty string", () => {
    const doc = makeDoc(`
      <html><body>
        <iframe src="https://child.example/foo"></iframe>
      </body></html>
    `);

    const result = scrapeIframeAllowAttributes(doc);

    expect(result[0].allow).toBe("");
  });

  it("captures all iframes in document order", () => {
    const doc = makeDoc(`
      <html><body>
        <iframe src="https://a.example/" allow="a"></iframe>
        <iframe src="https://b.example/" allow="b"></iframe>
        <iframe src="https://c.example/" allow="c"></iframe>
      </body></html>
    `);

    const result = scrapeIframeAllowAttributes(doc);

    expect(result.map((r) => r.src)).toEqual([
      "https://a.example/",
      "https://b.example/",
      "https://c.example/",
    ]);
    expect(result.map((r) => r.allow)).toEqual(["a", "b", "c"]);
  });

  it("marks srcdoc iframes and reports their src as empty", () => {
    const doc = makeDoc(`
      <html><body>
        <iframe srcdoc="<p>hi</p>" allow="publickey-credentials-get"></iframe>
      </body></html>
    `);

    const result = scrapeIframeAllowAttributes(doc);

    expect(result[0]).toEqual({
      src: "",
      allow: "publickey-credentials-get",
      srcdoc: true,
    });
  });

  it("captures iframes with no src and no srcdoc (about:blank style)", () => {
    const doc = makeDoc(`
      <html><body>
        <iframe allow="publickey-credentials-create"></iframe>
      </body></html>
    `);

    const result = scrapeIframeAllowAttributes(doc);

    expect(result[0].src).toBe("");
    expect(result[0].srcdoc).toBe(false);
    expect(result[0].allow).toBe("publickey-credentials-create");
  });

  it("does not include non-iframe elements", () => {
    const doc = makeDoc(`
      <html><body>
        <iframe src="https://a.example/" allow="a"></iframe>
        <frame src="https://b.example/"></frame>
        <embed src="https://c.example/" />
      </body></html>
    `);

    const result = scrapeIframeAllowAttributes(doc);

    expect(result).toHaveLength(1);
    expect(result[0].src).toBe("https://a.example/");
  });
});
