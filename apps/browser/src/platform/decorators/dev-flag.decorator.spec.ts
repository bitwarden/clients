import { devFlagEnabled } from "../flags";

import { devFlag } from "./dev-flag.decorator";

let devFlagEnabledMock: jest.Mock;
jest.mock("../flags", () => ({
  ...jest.requireActual("../flags"),
  devFlagEnabled: jest.fn(),
}));

class TestClass {
  @devFlag("managedEnvironment") test() {
    return "test";
  }
}

describe("devFlag decorator", () => {
  beforeEach(() => {
    devFlagEnabledMock = devFlagEnabled as jest.Mock;
  });

  it("should throw an error if the dev flag is disabled", () => {
    devFlagEnabledMock.mockReturnValue(false);
    expect(() => {
      new TestClass().test();
    }).toThrowError("This method should not be called, it is protected by a disabled dev flag.");
  });

  it("should not throw an error if the dev flag is enabled", () => {
    devFlagEnabledMock.mockReturnValue(true);
    expect(() => {
      new TestClass().test();
    }).not.toThrowError();
  });
});
