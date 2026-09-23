import { managed_settings } from "@bitwarden/desktop-napi";

import { WindowsManagedSettingsSource } from "./windows-managed-settings.source";

jest.mock("@bitwarden/desktop-napi", () => ({
  managed_settings: {
    read: jest.fn(),
    watch: jest.fn(),
  },
}));

const readMock = managed_settings.read as jest.Mock;
const watchMock = managed_settings.watch as jest.Mock;

describe("WindowsManagedSettingsSource", () => {
  const source = new WindowsManagedSettingsSource();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns the value the native read supplies", async () => {
    readMock.mockResolvedValue('{"a":1}');

    expect(await source.read()).toBe('{"a":1}');
  });

  it("maps a null native read to undefined", async () => {
    readMock.mockResolvedValue(null);

    expect(await source.read()).toBeUndefined();
  });

  it("invokes onChanged when the native watch callback fires", async () => {
    watchMock.mockImplementation(async (callback: () => void) => callback());
    const onChanged = jest.fn();

    await source.watch(onChanged);

    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
