import { UserId } from "@bitwarden/common/types/guid";
import type {
  AccessLeaseId,
  AccessLeaseView,
  AccessRequestView,
  CipherId,
  PamClient,
} from "@bitwarden/sdk-internal";

import { isLeaseLive, liveActiveLease } from "../shared/live-active-lease";
import { parseGuid, sdkIdToString, toSdkId } from "../shared/pam-ids";
import { PamInputError } from "../shared/pam-input-error";
import { PamSdkService } from "../shared/pam-sdk.service";

import { LEASE_ENDED_MESSAGE, validateExtension } from "./lease-extension";
import { LeaseRevealField, pickRevealField } from "./lease-reveal-field";

/** The access refusal for `reveal`, worded the same for every cause so none is leaked. */
export const ACCESS_NOT_AVAILABLE_MESSAGE = "access not available";

/** What `extend` settled on. Ids and states only. */
export interface LeaseExtensionResult {
  leaseId: string;
  requestId: string;
  status: AccessRequestView["status"];
  notAfter: string;
}

/** The lease operations of `bw privileged-controls lease`, over the SDK's `leases()` and read-only access state. */
export class LeasesService {
  constructor(
    private pamSdk: PamSdkService,
    private now: () => number = () => Date.now(),
  ) {}

  /** The caller's leases. With `activeOnly`, only those whose window is still open. */
  async list(userId: UserId, activeOnly: boolean) {
    return await this.pamSdk.run(userId, async (pam) => {
      return activeOnly ? await this.liveLeases(pam) : await pam.leases().list_mine();
    });
  }

  /**
   * The caller's own active leases whose window is still open. Read from `list_mine`, never
   * `list_active`: despite its doc comment, the server answers `list_active` with the active leases
   * on the collections the caller can MANAGE (the approver view), so it is empty for an ordinary
   * lease holder and would make every one of their leases look ended.
   */
  private async liveLeases(pam: PamClient): Promise<AccessLeaseView[]> {
    const mine = await pam.leases().list_mine();
    return mine.filter((l: AccessLeaseView) => l.status === "active" && isLeaseLive(l, this.now()));
  }

  /**
   * Extends a live lease. The lease must still be live (a lapsed one is refused as ended), the
   * rule must allow extensions, and `durationSeconds` must fit its maximum. A late extension the
   * server resolves as `denied` is refused as ended too.
   * @throws PamInputError for every refusal this code makes.
   */
  async extend(
    userId: UserId,
    leaseIdText: string,
    durationSeconds: number,
    reason: string,
  ): Promise<LeaseExtensionResult> {
    const leaseId = parseGuid(leaseIdText, "lease id");
    if (reason.trim() === "") {
      throw new PamInputError("A reason is required to extend a lease.");
    }
    return await this.pamSdk.run(userId, async (pam) => {
      const myLive = await this.liveLeases(pam);
      const lease = myLive.find(
        (l: AccessLeaseView) => sdkIdToString(l.id).toLowerCase() === leaseId,
      );
      if (lease == null) {
        throw new PamInputError(LEASE_ENDED_MESSAGE);
      }
      const state = await pam.access_requests().cipher_access_state(lease.cipherId);
      const live = liveActiveLease(state, this.now());
      if (live == null || sdkIdToString(live.id).toLowerCase() !== leaseId) {
        throw new PamInputError(LEASE_ENDED_MESSAGE);
      }
      validateExtension(state, durationSeconds);

      const request = await pam
        .leases()
        .extend(toSdkId<AccessLeaseId>(leaseId, "lease id"), { durationSeconds, reason });
      if (request.status === "denied") {
        throw new PamInputError(LEASE_ENDED_MESSAGE);
      }
      return {
        leaseId,
        requestId: sdkIdToString(request.id),
        status: request.status,
        notAfter: request.leaseNotAfter,
      };
    });
  }

  /** Ends a lease. Needs no seat. A holder end settles to canceled; an approver's revokes. */
  async end(userId: UserId, leaseIdText: string, reason: string | undefined): Promise<string> {
    const leaseId = parseGuid(leaseIdText, "lease id");
    await this.pamSdk.run(userId, async (pam) => {
      await pam.leases().end(toSdkId<AccessLeaseId>(leaseId, "lease id"), { reason });
    });
    return leaseId;
  }

  /**
   * Reads one field of a leased cipher. It fails closed with {@link ACCESS_NOT_AVAILABLE_MESSAGE}
   * unless the lease is live, the SDK returns a full (not partial) view, and its id matches. The
   * view is held only for this call and never stored.
   * @returns The secret text. Write it to stdout only.
   */
  async reveal(userId: UserId, cipherIdText: string, field: LeaseRevealField): Promise<string> {
    const cipherId = parseGuid(cipherIdText, "cipher id");
    return await this.pamSdk.run(userId, async (pam) => {
      const sdkCipherId = toSdkId<CipherId>(cipherId, "cipher id");
      const state = await pam.access_requests().cipher_access_state(sdkCipherId);
      if (liveActiveLease(state, this.now()) == null) {
        throw new PamInputError(ACCESS_NOT_AVAILABLE_MESSAGE);
      }
      const view = await pam.leases().leased_cipher(sdkCipherId);
      if (
        view == null ||
        view.partial !== false ||
        view.id == null ||
        sdkIdToString(view.id).toLowerCase() !== cipherId
      ) {
        throw new PamInputError(ACCESS_NOT_AVAILABLE_MESSAGE);
      }
      return pickRevealField(view, field);
    });
  }
}
