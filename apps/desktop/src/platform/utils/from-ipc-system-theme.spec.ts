import { ThemeType } from "@bitwarden/common/platform/enums";

import { fromIpcSystemTheme } from "./from-ipc-system-theme";

describe("fromIpcSystemTheme", () => {
  const originalIpcDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ipc");

  afterEach(() => {
    if (originalIpcDescriptor) {
      Object.defineProperty(globalThis, "ipc", originalIpcDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "ipc");
    }
  });

  it("emits the initial theme and subsequent updates, then cleans up on unsubscribe", async () => {
    const cleanup = jest.fn();
    let themeListener: ((theme: ThemeType) => void) | undefined;
    const onSystemThemeUpdated = jest.fn((listener) => {
      themeListener = listener;
      return cleanup;
    });
    Object.defineProperty(globalThis, "ipc", {
      configurable: true,
      value: {
        platform: {
          getSystemTheme: jest.fn().mockResolvedValue(ThemeType.Light),
          onSystemThemeUpdated,
        },
      },
    });
    const received: ThemeType[] = [];

    const subscription = fromIpcSystemTheme().subscribe((theme) => received.push(theme));
    await Promise.resolve();
    themeListener?.(ThemeType.Dark);

    expect(received).toEqual([ThemeType.Light, ThemeType.Dark]);

    subscription.unsubscribe();
    themeListener?.(ThemeType.Light);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(received).toEqual([ThemeType.Light, ThemeType.Dark]);
  });
});
