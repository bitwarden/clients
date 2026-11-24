import { NEVER_CANCEL } from "../../../utils/cancellation";

import { NO_CHECK } from "./checks";

describe("NO_CHECK", () => {
  it("lets every fill continue", async () => {
    expect(await NO_CHECK({}, NEVER_CANCEL)).toBeUndefined();
  });
});
