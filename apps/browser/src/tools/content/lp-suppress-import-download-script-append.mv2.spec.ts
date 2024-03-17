describe("LP Suppress Import Download for Manifest v2", () => {
  it("appends the `lp-suppress-import-download.js` script to the document element", () => {
    let createdScriptElement: HTMLScriptElement;
    jest.spyOn(window.document, "createElement");
    jest.spyOn(window.document.documentElement, "appendChild").mockImplementation((node) => {
      createdScriptElement = node as HTMLScriptElement;
      return node;
    });

    require("./lp-suppress-import-download-script-append.mv2");

    expect(window.document.createElement).toHaveBeenCalledWith("script");
    expect(chrome.runtime.getURL).toHaveBeenCalledWith("content/lp-suppress-import-download.js");
    expect(window.document.documentElement.appendChild).toHaveBeenCalledWith(
      expect.any(HTMLScriptElement),
    );
    expect(createdScriptElement.src).toBe(
      "chrome-extension://id/content/lp-suppress-import-download.js",
    );
  });
});
