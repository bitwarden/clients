import BrowserClipboardService from "./browser-clipboard.service";

describe("BrowserClipboardService", () => {
  let windowMock: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    windowMock = {
      navigator: {
        clipboard: {
          writeText: jest.fn(),
          readText: jest.fn(),
        },
      },
      document: {
        body: {
          appendChild: jest.fn((element) => document.body.appendChild(element)),
          removeChild: jest.fn((element) => document.body.removeChild(element)),
        },
        createElement: jest.fn((tagName) => document.createElement(tagName)),
        execCommand: jest.fn(),
        queryCommandSupported: jest.fn(),
      },
    };
  });

  describe("copy", () => {
    it("uses the legacy copy method if the clipboard API is not available", async () => {
      const text = "test";
      windowMock.navigator.clipboard = {};
      windowMock.document.queryCommandSupported.mockReturnValue(true);

      await BrowserClipboardService.copy(windowMock as Window, text);

      expect(windowMock.document.execCommand).toHaveBeenCalledWith("copy");
    });

    it("uses the legacy copy method if the clipboard API throws an error", async () => {
      windowMock.document.queryCommandSupported.mockReturnValue(true);
      windowMock.navigator.clipboard.writeText.mockRejectedValue(new Error("test"));

      await BrowserClipboardService.copy(windowMock as Window, "test");

      expect(windowMock.document.execCommand).toHaveBeenCalledWith("copy");
    });

    it("copies the given text to the clipboard", async () => {
      const text = "test";

      await BrowserClipboardService.copy(windowMock as Window, text);

      expect(windowMock.navigator.clipboard.writeText).toHaveBeenCalledWith(text);
    });

    it("prints an warning message to the console if both the clipboard api and legacy method throw an error", async () => {
      windowMock.document.queryCommandSupported.mockReturnValue(true);
      windowMock.navigator.clipboard.writeText.mockRejectedValue(new Error("test"));
      windowMock.document.execCommand.mockImplementation(() => {
        throw new Error("test");
      });

      await BrowserClipboardService.copy(windowMock as Window, "");

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe("read", () => {
    it("uses the legacy read method if the clipboard API is not available", async () => {
      const testValue = "test";
      windowMock.navigator.clipboard = {};
      windowMock.document.queryCommandSupported.mockReturnValue(true);
      windowMock.document.execCommand.mockImplementation(() => {
        document.querySelector("textarea").value = testValue;
        return true;
      });

      const returnValue = await BrowserClipboardService.read(windowMock as Window);

      expect(windowMock.document.execCommand).toHaveBeenCalledWith("paste");
      expect(returnValue).toBe(testValue);
    });

    it("uses the legacy read method if the clipboard API throws an error", async () => {
      windowMock.document.queryCommandSupported.mockReturnValue(true);
      windowMock.navigator.clipboard.readText.mockRejectedValue(new Error("test"));

      await BrowserClipboardService.read(windowMock as Window);

      expect(windowMock.document.execCommand).toHaveBeenCalledWith("paste");
    });

    it("reads the text from the clipboard", async () => {
      await BrowserClipboardService.read(windowMock as Window);

      expect(windowMock.navigator.clipboard.readText).toHaveBeenCalled();
    });

    it("prints a warning message to the console if both the clipboard api and legacy method throw an error", async () => {
      windowMock.document.queryCommandSupported.mockReturnValue(true);
      windowMock.navigator.clipboard.readText.mockRejectedValue(new Error("test"));
      windowMock.document.execCommand.mockImplementation(() => {
        throw new Error("test");
      });

      await BrowserClipboardService.read(windowMock as Window);
    });
  });
});
