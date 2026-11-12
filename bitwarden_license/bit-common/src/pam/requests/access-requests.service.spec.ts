import { mock, MockProxy } from "jest-mock-extended";

import type { AccessRequestCreateRequest, AccessRequestsClient } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";
import {
  createPamSdkTestKit,
  PamSdkTestKit,
  PAM_TEST_USER_ID,
} from "../shared/testing/pam-test-helpers";

import { AccessRequestsService } from "./access-requests.service";

const ID = "33333333-3333-4333-8333-333333333333";

describe("AccessRequestsService", () => {
  let kit: PamSdkTestKit;
  let client: MockProxy<AccessRequestsClient>;
  let service: AccessRequestsService;

  beforeEach(() => {
    kit = createPamSdkTestKit();
    client = mock<AccessRequestsClient>();
    service = new AccessRequestsService(kit.pamSdkService);
    kit.pam.access_requests.mockReturnValue(client);
  });

  it("passes branded ids to each SDK method", async () => {
    await service.cipherAccessState(PAM_TEST_USER_ID, ID.toUpperCase());
    await service.preCheck(PAM_TEST_USER_ID, ID);
    await service.get(PAM_TEST_USER_ID, ID);
    await service.activate(PAM_TEST_USER_ID, ID);
    await service.cancel(PAM_TEST_USER_ID, ID);
    await service.listMine(PAM_TEST_USER_ID);

    expect(client.cipher_access_state).toHaveBeenCalledWith(ID);
    expect(client.pre_check).toHaveBeenCalledWith(ID);
    expect(client.get).toHaveBeenCalledWith(ID);
    expect(client.activate).toHaveBeenCalledWith(ID);
    expect(client.cancel).toHaveBeenCalledWith(ID);
    expect(client.list_mine).toHaveBeenCalled();
  });

  it("sends the create request as given", async () => {
    const request: AccessRequestCreateRequest = {
      durationSeconds: 60,
      start: undefined,
      end: undefined,
      reason: undefined,
    };

    await service.request(PAM_TEST_USER_ID, ID, request);

    expect(client.request).toHaveBeenCalledWith(ID, request);
  });

  it("refuses a bad id before calling the SDK", async () => {
    await expect(service.get(PAM_TEST_USER_ID, "nope")).rejects.toThrow(PamInputError);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("does not log the reason when a request fails", async () => {
    client.request.mockRejectedValue(new Error("boom"));

    await expect(
      service.request(PAM_TEST_USER_ID, ID, {
        durationSeconds: undefined,
        start: undefined,
        end: undefined,
        reason: "secret-reason",
      }),
    ).rejects.toThrow("boom");

    expect(JSON.stringify(kit.logService.error.mock.calls)).not.toContain("secret-reason");
  });
});
