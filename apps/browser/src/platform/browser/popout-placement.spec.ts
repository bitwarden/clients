import { BrowserApi } from "./browser-api";
import {
  adjustRequestedPosition,
  computeCreationScale,
  ensurePopoutPlacement,
  isInsideScreen,
  loadPlacementMemory,
  POPOUT_PLACEMENT_STORAGE_KEY,
  PopoutPlacementMemory,
  positionInsideScreen,
  recordObservation,
  Rect,
  ScreenRecord,
} from "./popout-placement";

// Captured from Firefox on Windows: main display at 125% with a 100% display to its right.
const mainScreen: Rect = { left: 0, top: 0, width: 1536, height: 816 };
const secondaryScreen: Rect = { left: 1920, top: 0, width: 1920, height: 1152 };
// The secondary as seen by a popout stranded off-screen at the creation scale.
const secondaryScreenAtCreationScale: Rect = { left: 1536, top: 0, width: 1536, height: 922 };

const mainRecord: ScreenRecord = { ...mainScreen, scale: 1.25 };
const secondaryRecord: ScreenRecord = { ...secondaryScreen, scale: 1 };

const onMain = {
  sender: { left: -7, top: -7, width: 1550, height: 830 },
  requested: { left: 1048, top: 83 },
  window: { left: 1048, top: 83, width: 480, height: 570 },
  screen: mainScreen,
  devicePixelRatio: 1.25,
};
const onSecondaryWindowed = {
  sender: { left: 2109, top: 76, width: 1294, height: 741 },
  requested: { left: 2908, top: 166 },
  window: { left: 3635, top: 208, width: 480, height: 570 },
  screen: secondaryScreen,
  devicePixelRatio: 1,
};
const onSecondaryMaximised = {
  sender: { left: 1912, top: -8, width: 1936, height: 1168 },
  requested: { left: 3353, top: 82 },
  window: { left: 3353, top: 82, width: 480, height: 570 },
  screen: secondaryScreenAtCreationScale,
  devicePixelRatio: 1.25,
};

const learnedMemory: PopoutPlacementMemory = {
  creationScale: 1.25,
  screens: [mainRecord, secondaryRecord],
};

// Callback-only, as Firefox's `chrome` namespace is in MV2.
const storedMemory = (memory: unknown) =>
  (chrome.storage.local.get as jest.Mock).mockImplementation((_key, callback) =>
    callback(memory ? { [POPOUT_PLACEMENT_STORAGE_KEY]: memory } : {}),
  );

describe("popout-placement", () => {
  describe("computeCreationScale", () => {
    it.each([
      ["on the main display", onMain],
      ["windowed on the secondary", onSecondaryWindowed],
      ["maximised on the secondary", onSecondaryMaximised],
    ])("derives the main display's scale %s", (_, c) => {
      expect(computeCreationScale(c.requested, c.window, c.devicePixelRatio)).toBe(1.25);
    });

    it("rejects an implausible scale, such as from a popout that has since been moved", () => {
      expect(
        computeCreationScale({ left: 3353, top: 82 }, { left: 500, top: 300 }, 1.25),
      ).toBeUndefined();
    });

    it("returns undefined when the requested position is too close to the origin to be reliable", () => {
      expect(computeCreationScale({ left: 10, top: 20 }, { left: 13, top: 25 }, 1)).toBeUndefined();
    });
  });

  describe("isInsideScreen", () => {
    it("is true for a popout on the main display", () => {
      expect(isInsideScreen(onMain.window, onMain.screen)).toBe(true);
    });

    it("is false for a popout hanging off the secondary", () => {
      expect(isInsideScreen(onSecondaryWindowed.window, onSecondaryWindowed.screen)).toBe(false);
    });

    it("is false for a popout entirely off the secondary", () => {
      expect(isInsideScreen(onSecondaryMaximised.window, onSecondaryMaximised.screen)).toBe(false);
    });
  });

  describe("positionInsideScreen", () => {
    it("pulls a popout entirely off-screen back against the right edge", () => {
      expect(
        positionInsideScreen(onSecondaryMaximised.window, onSecondaryMaximised.screen, 15),
      ).toEqual({ left: 2577, top: 82 });
    });

    it("pulls a popout hanging off the right edge back on-screen", () => {
      expect(
        positionInsideScreen(onSecondaryWindowed.window, onSecondaryWindowed.screen, 15),
      ).toEqual({ left: 3345, top: 208 });
    });

    it("pulls a popout beyond the top-left corner back on-screen", () => {
      expect(
        positionInsideScreen(
          { left: 1500, top: -300, width: 480, height: 570 },
          secondaryScreen,
          15,
        ),
      ).toEqual({ left: 1920, top: 0 });
    });
  });

  describe("adjustRequestedPosition", () => {
    it("compensates for the creation scale when the sender is on the secondary", () => {
      expect(
        adjustRequestedPosition(
          onSecondaryWindowed.requested,
          onSecondaryWindowed.sender,
          learnedMemory,
        ),
      ).toEqual({ left: 2326, top: 133 });
    });

    it("compensates for the creation scale when the sender is maximised on the secondary", () => {
      expect(
        adjustRequestedPosition(
          onSecondaryMaximised.requested,
          onSecondaryMaximised.sender,
          learnedMemory,
        ),
      ).toEqual({ left: 2682, top: 66 });
    });

    it("leaves the position alone when the sender's screen uses the creation scale", () => {
      expect(adjustRequestedPosition(onMain.requested, onMain.sender, learnedMemory)).toEqual(
        onMain.requested,
      );
    });

    it("leaves the position alone without any memory", () => {
      expect(
        adjustRequestedPosition(
          onSecondaryWindowed.requested,
          onSecondaryWindowed.sender,
          undefined,
        ),
      ).toEqual(onSecondaryWindowed.requested);
    });

    it("leaves the position alone when the creation scale is unknown", () => {
      expect(
        adjustRequestedPosition(onSecondaryWindowed.requested, onSecondaryWindowed.sender, {
          screens: [mainRecord, secondaryRecord],
        }),
      ).toEqual(onSecondaryWindowed.requested);
    });

    it("leaves the position alone when the sender's screen hasn't been seen", () => {
      expect(
        adjustRequestedPosition(onSecondaryWindowed.requested, onSecondaryWindowed.sender, {
          creationScale: 1.25,
          screens: [mainRecord],
        }),
      ).toEqual(onSecondaryWindowed.requested);
    });
  });

  describe("recordObservation", () => {
    it("learns the creation scale and a screen the popout sits inside", () => {
      expect(recordObservation(undefined, onMain)).toEqual({
        creationScale: 1.25,
        screens: [mainRecord],
      });
    });

    it("learns the creation scale but not the screen when the popout is off-screen", () => {
      expect(recordObservation(undefined, onSecondaryMaximised)).toEqual({
        creationScale: 1.25,
        screens: [],
      });
    });

    it("learns a screen after a move without touching the creation scale", () => {
      const memory = recordObservation(
        { creationScale: 1.25, screens: [mainRecord] },
        {
          window: { left: 3345, top: 208, width: 480, height: 570 },
          screen: secondaryScreen,
          devicePixelRatio: 1,
        },
      );

      expect(memory).toEqual({ creationScale: 1.25, screens: [secondaryRecord, mainRecord] });
    });

    it("keeps the remembered creation scale when a new reading is implausible", () => {
      const memory = recordObservation(
        { creationScale: 1.25, screens: [] },
        { ...onMain, requested: { left: 3353, top: 82 } },
      );

      expect(memory.creationScale).toBe(1.25);
    });

    it("replaces a screen with the same bounds", () => {
      const memory = recordObservation(
        { creationScale: 1.25, screens: [{ ...mainScreen, scale: 1 }] },
        onMain,
      );

      expect(memory.screens).toEqual([mainRecord]);
    });

    it("keeps only the most recent screens", () => {
      let memory: PopoutPlacementMemory = { creationScale: 1, screens: [] };
      for (let i = 0; i < 10; i++) {
        const screen = { left: i * 2000, top: 0, width: 1920, height: 1080 };
        memory = recordObservation(memory, {
          window: { left: screen.left + 100, top: 100, width: 480, height: 570 },
          screen,
          devicePixelRatio: 1,
        });
      }

      expect(memory.screens).toHaveLength(8);
      expect(memory.screens[0].left).toBe(18000);
    });
  });

  describe("loadPlacementMemory", () => {
    afterEach(() => {
      (chrome.storage.local.get as jest.Mock).mockReset();
    });

    it("drops a stored creation scale that isn't plausible", async () => {
      storedMemory({ creationScale: 0, screens: [mainRecord] });

      expect(await loadPlacementMemory()).toEqual({
        creationScale: undefined,
        screens: [mainRecord],
      });
    });

    it("drops stored screens with missing or invalid values", async () => {
      storedMemory({
        creationScale: 1.25,
        screens: [
          mainRecord,
          { left: 1920, top: 0, width: 1920, height: 1152 },
          { ...secondaryRecord, width: 0 },
          { ...secondaryRecord, scale: "1" },
        ],
      });

      expect(await loadPlacementMemory()).toEqual({ creationScale: 1.25, screens: [mainRecord] });
    });

    it("ignores stored data that isn't placement memory", async () => {
      storedMemory("unexpected");

      expect(await loadPlacementMemory()).toBeUndefined();
    });
  });

  describe("ensurePopoutPlacement", () => {
    const popoutWindow = (
      href: string,
      c: { window: Rect; screen: Rect; devicePixelRatio: number },
    ) =>
      ({
        location: { href },
        screenX: c.window.left,
        screenY: c.window.top,
        outerWidth: c.window.width,
        outerHeight: c.window.height,
        devicePixelRatio: c.devicePixelRatio,
        screen: {
          availLeft: c.screen.left,
          availTop: c.screen.top,
          availWidth: c.screen.width,
          availHeight: c.screen.height,
        },
        history: { state: null, replaceState: jest.fn() },
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }) as unknown as Window;

    beforeEach(() => {
      jest.useFakeTimers();
      jest
        .spyOn(BrowserApi, "getCurrentWindow")
        .mockResolvedValue({ id: 7 } as chrome.windows.Window);
      jest.spyOn(BrowserApi, "updateWindowProperties").mockResolvedValue();
      storedMemory(undefined);
      (chrome.storage.local.set as jest.Mock).mockImplementation((_items, callback) => callback());
    });

    afterEach(() => {
      jest.useRealTimers();
      (chrome.storage.local.get as jest.Mock).mockReset();
      (chrome.storage.local.set as jest.Mock).mockReset();
      jest.restoreAllMocks();
    });

    it("does nothing for a popout the background didn't position", async () => {
      await ensurePopoutPlacement(
        popoutWindow("moz-extension://id/popup/index.html?uilocation=popout", onSecondaryMaximised),
      );

      expect(chrome.storage.local.get).not.toHaveBeenCalled();
      expect(BrowserApi.updateWindowProperties).not.toHaveBeenCalled();
    });

    it("moves an off-screen popout back on-screen and remembers the creation scale", async () => {
      const done = ensurePopoutPlacement(
        popoutWindow(
          "moz-extension://id/popup/index.html?uilocation=popout&popoutRequestedLeft=3353&popoutRequestedTop=82",
          onSecondaryMaximised,
        ),
      );
      await jest.advanceTimersByTimeAsync(500);
      await done;

      expect(BrowserApi.updateWindowProperties).toHaveBeenCalledWith(7, { left: 2577, top: 82 });
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { [POPOUT_PLACEMENT_STORAGE_KEY]: expect.objectContaining({ creationScale: 1.25 }) },
        expect.any(Function),
      );
    });

    it("leaves an on-screen popout where it is and remembers its screen", async () => {
      await ensurePopoutPlacement(
        popoutWindow(
          "moz-extension://id/popup/index.html?uilocation=popout&popoutRequestedLeft=1048&popoutRequestedTop=83",
          onMain,
        ),
      );

      expect(BrowserApi.updateWindowProperties).not.toHaveBeenCalled();
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { [POPOUT_PLACEMENT_STORAGE_KEY]: { creationScale: 1.25, screens: [mainRecord] } },
        expect.any(Function),
      );
    });

    it("never throws, so a placement failure can't stop the popup loading", async () => {
      jest.spyOn(BrowserApi, "updateWindowProperties").mockRejectedValue(new Error("move failed"));

      await expect(
        ensurePopoutPlacement(
          popoutWindow(
            "moz-extension://id/popup/index.html?uilocation=popout&popoutRequestedLeft=3353&popoutRequestedTop=82",
            onSecondaryMaximised,
          ),
        ),
      ).resolves.toBeUndefined();
    });

    it("removes the requested position from the URL so a reload isn't treated as a new popout", async () => {
      const win = popoutWindow(
        "moz-extension://id/popup/index.html?uilocation=popout&singleActionPopout=123&popoutRequestedLeft=1048&popoutRequestedTop=83#/fido2",
        onMain,
      );

      await ensurePopoutPlacement(win);

      expect(win.history.replaceState).toHaveBeenCalledWith(
        null,
        "",
        "moz-extension://id/popup/index.html?uilocation=popout&singleActionPopout=123#/fido2",
      );
    });

    it("builds on the remembered screens", async () => {
      storedMemory({ creationScale: 1.25, screens: [secondaryRecord] });

      await ensurePopoutPlacement(
        popoutWindow(
          "moz-extension://id/popup/index.html?uilocation=popout&popoutRequestedLeft=1048&popoutRequestedTop=83",
          onMain,
        ),
      );

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        {
          [POPOUT_PLACEMENT_STORAGE_KEY]: {
            creationScale: 1.25,
            screens: [mainRecord, secondaryRecord],
          },
        },
        expect.any(Function),
      );
    });

    it("ignores unreadable stored memory", async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error("storage unavailable");
      });

      await ensurePopoutPlacement(
        popoutWindow(
          "moz-extension://id/popup/index.html?uilocation=popout&popoutRequestedLeft=1048&popoutRequestedTop=83",
          onMain,
        ),
      );

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { [POPOUT_PLACEMENT_STORAGE_KEY]: { creationScale: 1.25, screens: [mainRecord] } },
        expect.any(Function),
      );
    });
  });
});
