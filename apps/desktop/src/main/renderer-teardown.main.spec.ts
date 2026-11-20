import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { ClipboardMain } from "../platform/main/clipboard.main";

jest.mock("./window.main", () => ({ WindowMain: jest.fn() }));
jest.mock("../platform/main/clipboard.main", () => ({ ClipboardMain: jest.fn() }));

import { RendererBlocker, RendererTeardownMain } from "./renderer-teardown.main";
import { WindowMain } from "./window.main";

describe("RendererTeardownMain", () => {
  let windowMain: MockProxy<WindowMain>;
  let clipboardMain: MockProxy<ClipboardMain>;

  const create = (flagEnabled: boolean, blockers: RendererBlocker[] = []) =>
    new RendererTeardownMain(flagEnabled, blockers, windowMain, clipboardMain, mock<LogService>());

  beforeEach(() => {
    windowMain = mock<WindowMain>();
    clipboardMain = mock<ClipboardMain>();
    clipboardMain.clearIfUnchanged.mockResolvedValue();
  });

  it("does nothing while the flag is off", () => {
    const sut = create(false);

    expect(sut.tryTearDown()).toBe(false);
    expect(windowMain.destroyRenderer).not.toHaveBeenCalled();
  });

  it("keeps the renderer while a blocker is active", () => {
    const sut = create(true, [
      { name: "idle", active: () => false },
      { name: "ssh-agent", active: () => true },
    ]);

    expect(sut.tryTearDown()).toBe(false);
    expect(windowMain.destroyRenderer).not.toHaveBeenCalled();
    expect(clipboardMain.clearIfUnchanged).not.toHaveBeenCalled();
  });

  it("clears the clipboard and destroys the renderer when nothing blocks", () => {
    const sut = create(true, [{ name: "idle", active: () => false }]);

    expect(sut.tryTearDown()).toBe(true);
    expect(clipboardMain.clearIfUnchanged).toHaveBeenCalled();
    expect(windowMain.destroyRenderer).toHaveBeenCalled();
  });
});
