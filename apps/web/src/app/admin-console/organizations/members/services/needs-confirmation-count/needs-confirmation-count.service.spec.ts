import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import {
  OrganizationUserApiService,
  OrganizationUserUserMiniResponse,
} from "@bitwarden/admin-console/common";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { NeedsConfirmationCountService } from "./needs-confirmation-count.service";

const ORG_ID = "org-1";

function miniDetails(
  ...statuses: OrganizationUserStatusType[]
): ListResponse<OrganizationUserUserMiniResponse> {
  return {
    data: statuses.map((status) => ({ status })),
  } as ListResponse<OrganizationUserUserMiniResponse>;
}

describe("NeedsConfirmationCountService", () => {
  let service: NeedsConfirmationCountService;
  let api: MockProxy<OrganizationUserApiService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    api = mock<OrganizationUserApiService>();
    logService = mock<LogService>();
    TestBed.configureTestingModule({
      providers: [
        { provide: OrganizationUserApiService, useValue: api },
        { provide: LogService, useValue: logService },
      ],
    });
    service = TestBed.inject(NeedsConfirmationCountService);
  });

  function collect(organizationId = ORG_ID) {
    const counts: number[] = [];
    const subscription = service.count$(organizationId).subscribe((count) => counts.push(count));
    return { counts, subscription };
  }

  it("counts the Accepted members", async () => {
    api.getAllMiniUserDetails.mockResolvedValue(
      miniDetails(
        OrganizationUserStatusType.Accepted,
        OrganizationUserStatusType.Confirmed,
        OrganizationUserStatusType.Accepted,
        OrganizationUserStatusType.Invited,
        OrganizationUserStatusType.Revoked,
      ),
    );

    const { counts } = collect();
    await Promise.resolve();

    expect(api.getAllMiniUserDetails).toHaveBeenCalledWith(ORG_ID);
    expect(counts).toEqual([2]);
  });

  it("follows the organization's updates after the fetch", async () => {
    api.getAllMiniUserDetails.mockResolvedValue(miniDetails(OrganizationUserStatusType.Accepted));

    const { counts } = collect();
    await Promise.resolve();
    service.update(ORG_ID, 0);
    service.update("other-org", 5);

    expect(counts).toEqual([1, 0]);
  });

  it("drops a fetch that resolves after an update, so it can't overwrite a newer count", async () => {
    let resolve!: (value: ListResponse<OrganizationUserUserMiniResponse>) => void;
    api.getAllMiniUserDetails.mockReturnValue(new Promise((r) => (resolve = r)));

    const { counts } = collect();
    service.update(ORG_ID, 3);
    resolve(miniDetails(OrganizationUserStatusType.Accepted));
    await Promise.resolve();

    expect(counts).toEqual([3]);
  });

  it("logs a failed fetch and counts none", async () => {
    const error = new Error("forbidden");
    api.getAllMiniUserDetails.mockRejectedValue(error);

    const { counts } = collect();
    await new Promise(process.nextTick);

    expect(logService.error).toHaveBeenCalledWith(error);
    expect(counts).toEqual([0]);
  });
});
