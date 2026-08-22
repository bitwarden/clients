import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BrowserApi } from "../../platform/browser/browser-api";
import { QualificationEngineCommand } from "../enums/autofill-message.enums";
import { QualificationEngine } from "../qualification/abstractions/qualification-engine";
import { QualificationEngineId } from "../qualification/types/engine-id";
import { QualificationEngineOverrideState } from "../services/qualification/engine-override.state";
import { QualificationStack } from "../services/qualification/qualification-service.factory";

import { QualificationEngineBackground } from "./qualification-engine.background";

type MessageListener = (
  message: { command?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => true | void;

describe("QualificationEngineBackground", () => {
  let stack: QualificationStack;
  let engine: MockProxy<QualificationEngine>;
  let resolvedId$: BehaviorSubject<QualificationEngineId>;
  let selection: QualificationEngineOverrideState;
  let background: QualificationEngineBackground;
  let listener: MessageListener;

  beforeEach(() => {
    engine = mock<QualificationEngine>();
    Object.defineProperty(engine, "id", { value: QualificationEngineId.Legacy, writable: true });
    // Returns true by default: the broadcast is gated on the swap having
    // actually changed something, so a mock that reports "no change" would
    // silently disable every push assertion below.
    stack = { engine, service: mock(), swap: jest.fn().mockReturnValue(true) };

    resolvedId$ = new BehaviorSubject<QualificationEngineId>(QualificationEngineId.Legacy);
    selection = mock<QualificationEngineOverrideState>();
    Object.defineProperty(selection, "resolvedId$", { value: resolvedId$ });

    jest
      .spyOn(BrowserApi, "messageListener")
      .mockImplementation((_name, handler) => (listener = handler as MessageListener));
    jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([]);

    background = new QualificationEngineBackground(stack, selection, mock<LogService>());
    background.init();
  });

  afterEach(() => {
    background.destroy();
    jest.restoreAllMocks();
  });

  it("swaps the stack to the resolved selection", () => {
    resolvedId$.next(QualificationEngineId.Scoring);

    expect(stack.swap).toHaveBeenCalledWith(QualificationEngineId.Scoring);
  });

  it("does not re-swap when the selection re-emits unchanged", () => {
    (stack.swap as jest.Mock).mockClear();

    resolvedId$.next(QualificationEngineId.Legacy);

    expect(stack.swap).not.toHaveBeenCalled();
  });

  it("answers a content script with the engine currently running", () => {
    const sendResponse = jest.fn();

    const handled = listener(
      { command: QualificationEngineCommand.request },
      { id: chrome.runtime.id } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(handled).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ engineId: QualificationEngineId.Legacy });
  });

  it("refuses to answer a sender that isn't this extension", () => {
    const sendResponse = jest.fn();

    listener(
      { command: QualificationEngineCommand.request },
      { id: "some-other-extension" } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(sendResponse).toHaveBeenCalledWith(null);
  });

  it("ignores commands it doesn't own", () => {
    const sendResponse = jest.fn();

    const handled = listener(
      { command: "collectPageDetails" },
      { id: chrome.runtime.id } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(handled).toBeUndefined();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it("pushes the new id to every frame of every http tab", async () => {
    const tab = { id: 7, url: "https://example.com" } as chrome.tabs.Tab;
    const skipped = { id: 8, url: "chrome://extensions" } as chrome.tabs.Tab;
    jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([tab, skipped]);
    jest
      .spyOn(BrowserApi, "getAllFrameDetails")
      .mockResolvedValue([
        { frameId: 0 },
        { frameId: 3 },
      ] as chrome.webNavigation.GetAllFrameResultDetails[]);
    const tabSendMessage = jest.spyOn(BrowserApi, "tabSendMessage").mockResolvedValue(undefined);

    resolvedId$.next(QualificationEngineId.Scoring);
    await Promise.resolve();
    await Promise.resolve();

    expect(BrowserApi.getAllFrameDetails).toHaveBeenCalledTimes(1);
    expect(BrowserApi.getAllFrameDetails).toHaveBeenCalledWith(7);
    expect(tabSendMessage).toHaveBeenCalledWith(
      tab,
      { command: QualificationEngineCommand.update, engineId: QualificationEngineId.Scoring },
      { frameId: 0 },
    );
    expect(tabSendMessage).toHaveBeenCalledWith(
      tab,
      { command: QualificationEngineCommand.update, engineId: QualificationEngineId.Scoring },
      { frameId: 3 },
    );
  });

  it("does not touch any tab when the swap changed nothing", async () => {
    // An MV3 service worker restart re-runs init() and re-subscribes, so
    // resolvedId$ replays the current selection. Sweeping every frame of every
    // tab to announce an unchanged id is pure waste, and restarts are frequent.
    (stack.swap as jest.Mock).mockReturnValue(false);
    // `init()` already emitted the initial selection and pushed for it, and
    // `spyOn` hands back the spy installed in `beforeEach` rather than a fresh
    // one — so clear it before acting.
    const tabsQuery = jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([]);
    tabsQuery.mockClear();

    resolvedId$.next(QualificationEngineId.Scoring);
    await Promise.resolve();
    await Promise.resolve();

    expect(stack.swap).toHaveBeenCalledWith(QualificationEngineId.Scoring);
    expect(tabsQuery).not.toHaveBeenCalled();
  });
});
