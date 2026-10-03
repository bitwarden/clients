import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "../../../abstractions/api.service";
import { SyncService } from "../../../vault/abstractions/sync/sync.service.abstraction";

import { OrganizationApiService } from "./organization-api.service";

describe("OrganizationApiService", () => {
  let apiService: MockProxy<ApiService>;
  let syncService: MockProxy<SyncService>;
  let sut: OrganizationApiService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    syncService = mock<SyncService>();
    sut = new OrganizationApiService(apiService, syncService);
  });

  describe("getAutoEnrollStatus", () => {
    beforeEach(() => {
      apiService.send.mockResolvedValue({ Id: "org-id", ResetPasswordEnabled: true });
    });

    it("passes the identifier as an encoded query parameter, not a path segment", async () => {
      // An admin-chosen SSO identifier can contain reserved URL characters (e.g. "/"). It must be
      // sent in the query string so it survives Utils.normalizePath (which decodes %2F in the path).
      // See ticket #870106.
      await sut.getAutoEnrollStatus("DQS/bitwarden");

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/organizations/auto-enroll-status?identifier=DQS%2Fbitwarden",
        null,
        true,
        true,
      );
    });

    it("encodes other reserved characters in the identifier", async () => {
      await sut.getAutoEnrollStatus("a b&c");

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/organizations/auto-enroll-status?identifier=a%20b%26c",
        null,
        true,
        true,
      );
    });

    it("maps the response", async () => {
      const result = await sut.getAutoEnrollStatus("DQS/bitwarden");

      expect(result.id).toBe("org-id");
      expect(result.resetPasswordEnabled).toBe(true);
    });
  });
});
