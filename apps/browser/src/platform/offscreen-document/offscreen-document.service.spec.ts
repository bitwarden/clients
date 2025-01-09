import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { DefaultOffscreenDocumentService } from "./offscreen-document.service";

class TestCase {
  synchronicity: string;
  private _callback: () => Promise<any> | any;
  get callback() {
    return jest.fn(this._callback);
  }

  constructor(synchronicity: string, callback: () => Promise<any> | any) {
    this.synchronicity = synchronicity;
    this._callback = callback;
  }

  toString() {
    return this.synchronicity;
  }
}

describe.each([
  new TestCase("synchronous callback", () => 42),
  new TestCase("asynchronous callback", () => Promise.resolve(42)),
])("DefaultOffscreenDocumentService %s", (testCase) => {
  const logService = mock<LogService>();
  let sut: DefaultOffscreenDocumentService;
  const reasons = [chrome.offscreen.Reason.TESTING];
  const justification = "justification is testing";
  const url = "offscreen-document/index.html";
  const api = {
    createDocument: jest.fn(),
    closeDocument: jest.fn(),
    hasDocument: jest.fn().mockResolvedValue(false),
    Reason: chrome.offscreen.Reason,
  };
  let callback: jest.Mock<() => Promise<number> | number>;

  beforeEach(() => {
    callback = testCase.callback;
    chrome.offscreen = api;

    sut = new DefaultOffscreenDocumentService(logService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("offscreenApiSupported", () => {
    it("indicates whether the offscreen API is supported", () => {
      expect(sut.offscreenApiSupported()).toBe(true);
    });
  });

  describe("withDocument", () => {
    it("creates a document when none exists", async () => {
      await sut.withDocument(reasons, justification, () => {});

      expect(chrome.offscreen.createDocument).toHaveBeenCalledWith({
        url,
        reasons,
        justification,
      });
    });

    it("does not create a document when one exists", async () => {
      api.hasDocument.mockResolvedValue(true);

      await sut.withDocument(reasons, justification, callback);

      expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
    });

    describe.each([true, false])("hasDocument returns %s", (hasDocument) => {
      beforeEach(() => {
        api.hasDocument.mockResolvedValue(hasDocument);
      });

      it("calls the callback", async () => {
        await sut.withDocument(reasons, justification, callback);

        expect(callback).toHaveBeenCalled();
      });

      it("returns the callback result", async () => {
        const result = await sut.withDocument(reasons, justification, callback);

        expect(result).toBe(42);
      });

      it("closes the document when the callback completes and no other callbacks are running", async () => {
        await sut.withDocument(reasons, justification, callback);

        expect(chrome.offscreen.closeDocument).toHaveBeenCalled();
      });

      it("does not close the document when the callback completes and other callbacks are running", async () => {
        await Promise.all([
          sut.withDocument(reasons, justification, callback),
          sut.withDocument(reasons, justification, callback),
          sut.withDocument(reasons, justification, callback),
          sut.withDocument(reasons, justification, callback),
        ]);

        expect(chrome.offscreen.closeDocument).toHaveBeenCalledTimes(1);
      });
    });
  });
});
