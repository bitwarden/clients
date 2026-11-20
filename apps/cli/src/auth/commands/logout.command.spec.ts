import { mock, MockProxy } from "jest-mock-extended";

import { LogoutService } from "@bitwarden/common/auth/logout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";

import { MessageResponse } from "../../models/response/message.response";

import { LogoutCommand } from "./logout.command";

describe("LogoutCommand", () => {
  const userId = "user-id" as UserId;

  let logoutService: MockProxy<LogoutService>;
  let sut: LogoutCommand;

  beforeEach(() => {
    logoutService = mock<LogoutService>();
    sut = new LogoutCommand(mock<I18nService>(), logoutService);
  });

  it("logs out the given user as a user-initiated logout", async () => {
    await sut.run(userId);

    expect(logoutService.logout).toHaveBeenCalledWith(userId, "userInitiated");
  });

  it("returns a success response", async () => {
    const response = await sut.run(userId);

    expect(response.success).toBe(true);
    expect((response.data as MessageResponse).title).toBe("You have logged out.");
  });

  it("rejects when the logout fails", async () => {
    logoutService.logout.mockRejectedValue(new Error("Logout failed"));

    await expect(sut.run(userId)).rejects.toThrow("Logout failed");
  });
});
