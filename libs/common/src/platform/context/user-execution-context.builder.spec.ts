import { mockAccountServiceWith } from "../../../spec";
import { UserId } from "../../types/guid";

import { UserExecutionContextBuilder } from "./user-execution-context.builder";

describe("UserExecutionContextBuilder", () => {
  const userId = "user1" as UserId;
  const accountService = mockAccountServiceWith(userId);

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("builds the context with the current user", async () => {
    const context = await new UserExecutionContextBuilder(accountService).build();

    expect(context).toEqual({ userId });
  });
});
