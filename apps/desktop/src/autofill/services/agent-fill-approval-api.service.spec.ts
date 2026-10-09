import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { AgentFillApprovalApiService } from "./agent-fill-approval-api.service";

describe("AgentFillApprovalApiService", () => {
  const apiService = mock<ApiService>();
  let sut: AgentFillApprovalApiService;

  const record = (extra: object = {}) => ({
    Id: "approval-1",
    SealedRequest: "sealed-request",
    Status: "pending",
    ...extra,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [AgentFillApprovalApiService, { provide: ApiService, useValue: apiService }],
    });
    sut = TestBed.inject(AgentFillApprovalApiService);
  });

  it("POSTs the sealed request and parses the record", async () => {
    apiService.send.mockResolvedValue(record());

    const result = await sut.create("sealed-request");

    expect(apiService.send).toHaveBeenCalledWith(
      "POST",
      "/agent-fill/approvals",
      { sealedRequest: "sealed-request" },
      true,
      true,
    );
    expect(result.id).toBe("approval-1");
    expect(result.sealedResponse).toBeNull();
  });

  describe("answer", () => {
    it("returns answered on 200", async () => {
      apiService.send.mockResolvedValue(record({ SealedResponse: "sealed-response" }));

      const result = await sut.answer("approval-1", "sealed-response");

      expect(result.kind).toBe("answered");
    });

    it("returns the stored record on 409", async () => {
      apiService.send
        .mockRejectedValueOnce(new ErrorResponse({}, 409))
        .mockResolvedValueOnce(record({ SealedResponse: "phone-response", Status: "answered" }));

      const result = await sut.answer("approval-1", "sealed-response");

      expect(apiService.send).toHaveBeenLastCalledWith(
        "GET",
        "/agent-fill/approvals/approval-1",
        null,
        true,
        true,
      );
      expect(result).toEqual({
        kind: "alreadyAnswered",
        record: expect.objectContaining({ sealedResponse: "phone-response" }),
      });
    });

    it("returns expired on 410", async () => {
      apiService.send.mockRejectedValue(new ErrorResponse({}, 410));

      expect(await sut.answer("approval-1", "sealed-response")).toEqual({ kind: "expired" });
    });

    it("rethrows any other error", async () => {
      const error = new ErrorResponse({}, 500);
      apiService.send.mockRejectedValue(error);

      await expect(sut.answer("approval-1", "sealed-response")).rejects.toBe(error);
    });
  });
});
