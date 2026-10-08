import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { AgentFillPendingRequestService } from "./agent-fill-pending-request.service";

const request = (approvalId: string) => ({
  approvalId,
  domain: "www.delta.com",
  connectionName: "Claude Desktop",
});

describe("AgentFillPendingRequestService", () => {
  let service: AgentFillPendingRequestService;

  beforeEach(() => {
    service = new AgentFillPendingRequestService(
      new FakeStateProvider(mockAccountServiceWith("user-1" as UserId)),
    );
  });

  it("has no pending request by default", async () => {
    expect(await firstValueFrom(service.pendingRequest$)).toBeNull();
  });

  it("emits the pending request once it is set", async () => {
    await service.setPending(request("a1"));

    expect(await firstValueFrom(service.pendingRequest$)).toEqual(request("a1"));
  });

  it("clears the request it was asked to clear", async () => {
    await service.setPending(request("a1"));

    await service.clear("a1");

    expect(await firstValueFrom(service.pendingRequest$)).toBeNull();
  });

  it("keeps a newer request when a late close arrives for an older one", async () => {
    await service.setPending(request("a1"));
    await service.setPending(request("a2"));

    await service.clear("a1");

    expect(await firstValueFrom(service.pendingRequest$)).toEqual(request("a2"));
  });
});
