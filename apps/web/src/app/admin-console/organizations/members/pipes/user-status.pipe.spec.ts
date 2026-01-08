import { MockProxy, mock } from "jest-mock-extended";

import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { UserStatusPipe } from "./user-status.pipe";

describe("UserStatusPipe", () => {
  let pipe: UserStatusPipe;
  let i18nService: MockProxy<I18nService>;

  beforeEach(() => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);
    pipe = new UserStatusPipe(i18nService);
  });

  it("transforms OrganizationUserStatusType.Invited to 'invited'", () => {
    expect(pipe.transform(OrganizationUserStatusType.Invited)).toBe("invited");
    expect(i18nService.t).toHaveBeenCalledWith("invited");
  });

  it("transforms OrganizationUserStatusType.Accepted to 'accepted'", () => {
    expect(pipe.transform(OrganizationUserStatusType.Accepted)).toBe("accepted");
    expect(i18nService.t).toHaveBeenCalledWith("accepted");
  });

  it("transforms OrganizationUserStatusType.Confirmed to 'confirmed'", () => {
    expect(pipe.transform(OrganizationUserStatusType.Confirmed)).toBe("confirmed");
    expect(i18nService.t).toHaveBeenCalledWith("confirmed");
  });

  it("transforms OrganizationUserStatusType.Revoked to 'revoked'", () => {
    expect(pipe.transform(OrganizationUserStatusType.Revoked)).toBe("revoked");
    expect(i18nService.t).toHaveBeenCalledWith("revoked");
  });

  it("transforms null to 'unknown'", () => {
    expect(pipe.transform(null)).toBe("unknown");
    expect(i18nService.t).toHaveBeenCalledWith("unknown");
  });

  it("transforms undefined to 'unknown'", () => {
    expect(pipe.transform(undefined)).toBe("unknown");
    expect(i18nService.t).toHaveBeenCalledWith("unknown");
  });
});
