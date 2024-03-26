import { Fido2ContentScript } from "../enums/fido2-content-script.enum";

describe("FIDO2 page-script for manifest v2", () => {
  let createdScriptElement: HTMLScriptElement;
  jest.spyOn(window.document, "createElement");

  afterEach(() => {
    Object.defineProperty(window.document, "contentType", { value: "text/html", writable: true });
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("skips appending the `page-script.js` file if the document contentType is not `text/html`", () => {
    Object.defineProperty(window.document, "contentType", { value: "text/plain", writable: true });

    require("./page-script-append.mv2");

    expect(window.document.createElement).not.toHaveBeenCalled();
  });

  it("appends the `page-script.js` file to the document head", () => {
    jest.spyOn(window.document.head, "insertBefore").mockImplementation((node) => {
      createdScriptElement = node as HTMLScriptElement;
      return node;
    });

    require("./page-script-append.mv2");

    expect(window.document.createElement).toHaveBeenCalledWith("script");
    expect(chrome.runtime.getURL).toHaveBeenCalledWith(Fido2ContentScript.PageScript);
    expect(window.document.head.insertBefore).toHaveBeenCalledWith(
      expect.any(HTMLScriptElement),
      window.document.head.firstChild,
    );
    expect(createdScriptElement.src).toBe(`chrome-extension://id/${Fido2ContentScript.PageScript}`);
  });

  it("appends the `page-script.js` file to the document element if the head is not available", () => {
    window.document.documentElement.removeChild(window.document.head);
    jest.spyOn(window.document.documentElement, "insertBefore").mockImplementation((node) => {
      createdScriptElement = node as HTMLScriptElement;
      return node;
    });

    require("./page-script-append.mv2");

    expect(window.document.createElement).toHaveBeenCalledWith("script");
    expect(chrome.runtime.getURL).toHaveBeenCalledWith(Fido2ContentScript.PageScript);
    expect(window.document.documentElement.insertBefore).toHaveBeenCalledWith(
      expect.any(HTMLScriptElement),
      window.document.documentElement.firstChild,
    );
    expect(createdScriptElement.src).toBe(`chrome-extension://id/${Fido2ContentScript.PageScript}`);
  });

  it("removes the appended `page-script.js` file after the script has triggered a load event", () => {
    createdScriptElement = document.createElement("script");
    jest.spyOn(window.document, "createElement").mockImplementation((element) => {
      return createdScriptElement;
    });

    require("./page-script-append.mv2");

    jest.spyOn(createdScriptElement, "remove");
    createdScriptElement.dispatchEvent(new Event("load"));

    expect(createdScriptElement.remove).toHaveBeenCalled();
  });
});
