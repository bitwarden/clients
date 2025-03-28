import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthRequestType } from "@bitwarden/common/auth/enums/auth-request-type";
import { AuthRequestUpdateRequest } from "@bitwarden/common/auth/models/request/auth-request-update.request";
import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { DefaultAuthRequestApiService } from "./auth-request-api.service";

describe("DefaultAuthRequestApiService", () => {
  let service: DefaultAuthRequestApiService;
  let apiService: MockProxy<ApiService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    logService = mock<LogService>();
    service = new DefaultAuthRequestApiService(apiService, logService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getAuthRequest", () => {
    it("calls API with correct parameters", async () => {
      const requestId = "test-request-id";
      apiService.send.mockResolvedValue(true);

      const result = await service.getAuthRequest(requestId);

      expect(result).toBeInstanceOf(AuthRequestResponse);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/auth-requests/" + requestId,
        null,
        true,
        true,
      );
    });
  });

  describe("getAuthResponse", () => {
    it("calls API with correct parameters", async () => {
      const requestId = "test-request-id";
      const accessCode = "test-access-code";
      apiService.send.mockResolvedValue(true);

      const result = await service.getAuthResponse(requestId, accessCode);

      expect(result).toBeInstanceOf(AuthRequestResponse);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/auth-requests/" + requestId + "/response?code=" + accessCode,
        null,
        false,
        true,
      );
    });
  });

  describe("postAdminAuthRequest", () => {
    it("calls API with correct parameters", async () => {
      const mockRequest = new AuthRequest(
        "test@test.com",
        "test-identifier",
        "test-public-key",
        AuthRequestType.AdminApproval,
        "test-access-code",
      );

      const result = await service.postAdminAuthRequest(mockRequest);

      expect(result).toBeInstanceOf(AuthRequestResponse);
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/auth-requests/admin-request",
        mockRequest,
        true,
        true,
      );
    });
  });

  describe("postAuthRequest", () => {
    it("calls API with correct parameters", async () => {
      const mockRequest = new AuthRequest(
        "test@test.com",
        "test-identifier",
        "test-public-key",
        AuthRequestType.AuthenticateAndUnlock,
        "test-access-code",
      );

      const result = await service.postAuthRequest(mockRequest);

      expect(result).toBeInstanceOf(AuthRequestResponse);
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/auth-requests/",
        mockRequest,
        false,
        true,
        null,
        expect.any(Function),
      );
    });
  });

  describe("putAuthRequest", () => {
    it("calls API with correct parameters", async () => {
      const requestId = "test-request-id";
      const mockRequest = new AuthRequestUpdateRequest(
        "test-key",
        "test-hash",
        "test-identifier",
        true,
      );
      const result = await service.putAuthRequest(requestId, mockRequest);

      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/auth-requests/" + requestId,
        mockRequest,
        true,
        true,
      );
      expect(result).toBeInstanceOf(AuthRequestResponse);
    });
  });

  describe("getAuthRequests", () => {
    it("calls API with correct parameters and return list", async () => {
      const mockResponse = { data: [{ id: "test-request-id-1" }, { id: "test-request-id-2" }] };
      apiService.send.mockResolvedValue(mockResponse);

      const result = await service.getAuthRequests();

      expect(apiService.send).toHaveBeenCalledWith("GET", "/auth-requests/", null, true, true);
      expect(result).toBeInstanceOf(ListResponse<AuthRequestResponse>);
    });
  });
});
