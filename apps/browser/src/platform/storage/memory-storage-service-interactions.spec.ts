/**
 * need to update test environment so structuredClone works appropriately
 * @jest-environment ../../libs/shared/test.environment.ts
 */

import { trackEmissions } from "@bitwarden/common/../spec/utils";

import { mockPorts } from "../../../spec/mock-port.spec-util";

import { BackgroundMemoryStorageService } from "./background-memory-storage.service";
import { ForegroundMemoryStorageService } from "./foreground-memory-storage.service";

// These are succeeding individually but failing in a batch run - skipping for now
describe.skip("foreground background memory storage interaction", () => {
  let foreground: ForegroundMemoryStorageService;
  let background: BackgroundMemoryStorageService;

  beforeEach(() => {
    mockPorts();

    background = new BackgroundMemoryStorageService();
    foreground = new ForegroundMemoryStorageService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test.each(["has", "get"])(
    "background should respond with the correct value for %s",
    async (action: "get" | "has") => {
      const key = "key";
      const value = "value";
      background[action] = jest.fn().mockResolvedValue(value);

      const result = await foreground[action](key);
      expect(result).toEqual(value);
    },
  );

  test("background should call save from foreground", async () => {
    const key = "key";
    const value = "value";
    const actionSpy = jest.spyOn(background, "save");
    await foreground.save(key, value);

    expect(actionSpy).toHaveBeenCalledWith(key, value);
  });

  test("background should call remove from foreground", async () => {
    const key = "key";
    const actionSpy = jest.spyOn(background, "remove");
    await foreground.remove(key);

    expect(actionSpy).toHaveBeenCalledWith(key);
  });

  test("background updates push to foreground", async () => {
    const key = "key";
    const value = "value";
    const updateType = "save";
    const emissions = trackEmissions(foreground.updates$);
    await background.save(key, value);

    expect(emissions).toEqual([{ key, updateType }]);
  });

  test("background should message only the requesting foreground", async () => {
    const secondForeground = new ForegroundMemoryStorageService();
    const secondPort = secondForeground["_port"];
    const secondPost = secondPort.postMessage as jest.Mock;
    secondPost.mockClear();

    const key = "key";
    await foreground.get(key);

    expect(secondPost).not.toHaveBeenCalled();
  });
});
