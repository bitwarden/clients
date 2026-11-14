import { mock } from "jest-mock-extended";
import { Subject, firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Message, MessageListener } from "@bitwarden/common/platform/messaging";
import { TaskSchedulerService } from "@bitwarden/common/platform/scheduling";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";

import {
  ClEAR_VIEW_CACHE_COMMAND,
  POPUP_VIEW_CACHE_KEY,
  PopupViewCacheBackgroundService,
  SAVE_VIEW_CACHE_COMMAND,
} from "./popup-view-cache-background.service";

const flushPromises = async () => await new Promise(process.nextTick);

describe("PopupViewCacheBackgroundService", () => {
  const logService = mock<LogService>();
  let messages: Subject<Message<Record<string, unknown>>>;
  let globalStateProvider: FakeGlobalStateProvider;
  let service: PopupViewCacheBackgroundService;

  const save = (key: string, value: string) =>
    messages.next({ command: SAVE_VIEW_CACHE_COMMAND.command, key, value, options: {} });

  beforeEach(() => {
    jest.clearAllMocks();
    messages = new Subject();
    globalStateProvider = new FakeGlobalStateProvider();
    service = new PopupViewCacheBackgroundService(
      new MessageListener(messages),
      globalStateProvider,
      mock<TaskSchedulerService>(),
      logService,
    );
    service.startObservingMessages();
  });

  it("saves view cache entries", async () => {
    save("a", "1");
    await flushPromises();

    const state = await firstValueFrom(globalStateProvider.getFake(POPUP_VIEW_CACHE_KEY).state$);
    expect(state).toEqual({ a: { value: "1", options: {} } });
  });

  it("logs a failed save and keeps processing later saves", async () => {
    const state = globalStateProvider.getFake(POPUP_VIEW_CACHE_KEY);
    const error = new Error("QUOTA_BYTES quota exceeded");
    jest.spyOn(state, "update").mockRejectedValueOnce(error);

    save("a", "1");
    save("b", "2");
    await flushPromises();

    expect(logService.error).toHaveBeenCalledWith(expect.stringContaining('"a"'), error);
    expect(await firstValueFrom(state.state$)).toEqual({ b: { value: "2", options: {} } });
  });

  it("drops an entry that would push the cache over the storage quota and keeps the rest", async () => {
    const state = globalStateProvider.getFake(POPUP_VIEW_CACHE_KEY);
    const quotaBytes = 200;
    const update = state.update.bind(state);
    jest.spyOn(state, "update").mockImplementation(async (configureState) => {
      const next = configureState(await firstValueFrom(state.state$), null);
      if (new TextEncoder().encode(JSON.stringify(next)).byteLength > quotaBytes) {
        throw new Error("QUOTA_BYTES quota exceeded");
      }
      return update(configureState);
    });

    save("small", "1");
    save("oversized", "x".repeat(quotaBytes));
    save("later", "2");
    await flushPromises();

    expect(logService.error).toHaveBeenCalledTimes(1);
    expect(logService.error).toHaveBeenCalledWith(
      expect.stringContaining('"oversized"'),
      expect.any(Error),
    );
    expect(await firstValueFrom(state.state$)).toEqual({
      small: { value: "1", options: {} },
      later: { value: "2", options: {} },
    });
  });

  it("logs a failed clear and keeps processing later messages", async () => {
    const state = globalStateProvider.getFake(POPUP_VIEW_CACHE_KEY);
    const error = new Error("QUOTA_BYTES quota exceeded");
    jest.spyOn(state, "update").mockRejectedValueOnce(error);

    messages.next({ command: ClEAR_VIEW_CACHE_COMMAND.command, routeChange: false });
    save("a", "1");
    await flushPromises();

    expect(logService.error).toHaveBeenCalledWith(expect.any(String), error);
    expect(await firstValueFrom(state.state$)).toEqual({ a: { value: "1", options: {} } });
  });
});
