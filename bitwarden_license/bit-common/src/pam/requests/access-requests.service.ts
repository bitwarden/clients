import type { UserId } from "@bitwarden/common/types/guid";
import type {
  AccessLeaseView,
  AccessPreCheckView,
  AccessRequestCreateRequest,
  AccessRequestId,
  AccessRequestResultView,
  AccessRequestView,
  CipherAccessStateView,
  CipherId,
} from "@bitwarden/sdk-internal";

import { toSdkId } from "../shared/pam-ids";
import { PamSdkService } from "../shared/pam-sdk.service";

/**
 * The access request SDK calls the `bw pam request` commands make, and nothing else. Ids are
 * validated and branded here, so a caller passes the text the operator typed.
 *
 * Nothing here logs a request: `PamSdkService.run` logs only an error's name and message, and
 * the create request carries a reason.
 */
export class AccessRequestsService {
  constructor(private pamSdk: PamSdkService) {}

  async cipherAccessState(userId: UserId, cipherId: string): Promise<CipherAccessStateView> {
    const id = toSdkId<CipherId>(cipherId, "cipher id");
    return await this.pamSdk.run(userId, (pam) => pam.access_requests().cipher_access_state(id));
  }

  async preCheck(userId: UserId, cipherId: string): Promise<AccessPreCheckView> {
    const id = toSdkId<CipherId>(cipherId, "cipher id");
    return await this.pamSdk.run(userId, (pam) => pam.access_requests().pre_check(id));
  }

  async request(
    userId: UserId,
    cipherId: string,
    request: AccessRequestCreateRequest,
  ): Promise<AccessRequestResultView> {
    const id = toSdkId<CipherId>(cipherId, "cipher id");
    return await this.pamSdk.run(userId, (pam) => pam.access_requests().request(id, request));
  }

  async listMine(userId: UserId): Promise<AccessRequestView[]> {
    return await this.pamSdk.run(userId, (pam) => pam.access_requests().list_mine());
  }

  async get(userId: UserId, requestId: string): Promise<AccessRequestView> {
    const id = toSdkId<AccessRequestId>(requestId, "request id");
    return await this.pamSdk.run(userId, (pam) => pam.access_requests().get(id));
  }

  /** Mints the lease. The caller must not read a credential from it. */
  async activate(userId: UserId, requestId: string): Promise<AccessLeaseView> {
    const id = toSdkId<AccessRequestId>(requestId, "request id");
    return await this.pamSdk.run(userId, (pam) => pam.access_requests().activate(id));
  }

  async cancel(userId: UserId, requestId: string): Promise<void> {
    const id = toSdkId<AccessRequestId>(requestId, "request id");
    await this.pamSdk.run(userId, (pam) => pam.access_requests().cancel(id));
  }
}
