import { AutomaticUserConfirmationService } from "./abstractions";
import { AutoConfirmState } from "./models";

describe("auto-confirm", () => {
  it("should export abstractions", () => {
    expect(AutomaticUserConfirmationService).toBeDefined();
  });

  it("should export models", () => {
    expect(AutoConfirmState).toBeDefined();
  });
});
