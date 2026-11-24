import { mock } from "jest-mock-extended";

import { BrowserApi } from "../../platform/browser/browser-api";
import { createChromeTabMock } from "../spec/autofill-mocks";

import { browserFill } from "./fill-browser";

describe("browserFill", () => {
  afterEach(() => jest.restoreAllMocks());

  describe("tab", () => {
    it("is the tab the browser reports", async () => {
      const tab = createChromeTabMock({ id: 4 });
      jest.spyOn(BrowserApi, "getTab").mockResolvedValue(tab);

      await expect(browserFill.tab(4)).resolves.toBe(tab);
      expect(BrowserApi.getTab).toHaveBeenCalledWith(4);
    });

    it.each<[string, () => Promise<chrome.tabs.Tab>]>([
      ["reports none", () => Promise.resolve(null as never)],
      ["rejects", () => Promise.reject(new Error("No tab with id: 4"))],
    ])("is undefined when the browser %s", async (_, read) => {
      jest.spyOn(BrowserApi, "getTab").mockImplementation(read);

      await expect(browserFill.tab(4)).resolves.toBeUndefined();
    });
  });

  describe("frame", () => {
    it("is the document the browser reports for the frame, and nothing else of it", async () => {
      jest.spyOn(BrowserApi, "getFrameDetails").mockResolvedValue(
        mock<chrome.webNavigation.GetFrameResultDetails>({
          documentId: "document-1",
          url: "https://example.com",
        }),
      );

      await expect(browserFill.frame(4, 2)).resolves.toEqual({ documentId: "document-1" });
      expect(BrowserApi.getFrameDetails).toHaveBeenCalledWith({ tabId: 4, frameId: 2 });
    });

    it("keeps a document the browser does not name as undefined", async () => {
      jest
        .spyOn(BrowserApi, "getFrameDetails")
        .mockResolvedValue(
          mock<chrome.webNavigation.GetFrameResultDetails>({ documentId: undefined }),
        );

      await expect(browserFill.frame(4, 0)).resolves.toEqual({ documentId: undefined });
    });

    it.each<[string, () => Promise<chrome.webNavigation.GetFrameResultDetails>]>([
      ["reports none", () => Promise.resolve(undefined as never)],
      ["rejects", () => Promise.reject(new Error("No frame"))],
    ])("is undefined when the browser %s", async (_, read) => {
      jest.spyOn(BrowserApi, "getFrameDetails").mockImplementation(read);

      await expect(browserFill.frame(4, 0)).resolves.toBeUndefined();
    });
  });

  describe("activeTab", () => {
    it("is the current window's active tab", async () => {
      const tab = createChromeTabMock({ id: 4 });
      jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockResolvedValue(tab);

      await expect(browserFill.activeTab()).resolves.toBe(tab);
    });

    it.each<[string, () => Promise<chrome.tabs.Tab>]>([
      ["reports none", () => Promise.resolve(null as never)],
      ["rejects", () => Promise.reject(new Error("No window"))],
    ])("is undefined when the browser %s", async (_, read) => {
      jest.spyOn(BrowserApi, "getTabFromCurrentWindow").mockImplementation(read);

      await expect(browserFill.activeTab()).resolves.toBeUndefined();
    });
  });
});
