import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { GatedCipherFetchResult } from "../abstractions/gated-cipher-fetch-result";
import { PamApiService } from "../abstractions/pam-api.service";
import { CollectionLeasingConfigResponse } from "../abstractions/responses/collection-leasing.response";
import { LeaseRequestResponse } from "../abstractions/responses/lease-request.response";

import { CollectionLeasingRequest } from "./requests/collection-leasing.request";
import { LeaseDecisionRequest } from "./requests/lease-decision.request";
import { LeaseExtensionRequest } from "./requests/lease-extension.request";
import { LeaseRequestPatchRequest } from "./requests/lease-request-patch.request";
import { LeaseRevokeRequest } from "./requests/lease-revoke.request";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class DefaultPamApiService implements PamApiService {
  constructor(
    private apiService: ApiService,
    // PM-37264: the gated cipher round-trip needs raw fetch access (status-code
    // routing for 200/202/403 plus body preservation on non-200). The existing
    // `apiService.send` is unsuitable — see `fetchGatedCipher` for details — so
    // we drive the transport ourselves using these two collaborators.
    private environmentService?: EnvironmentService,
    private accountService?: AccountService,
  ) {}

  /**
   * Issues a gated cipher fetch (PM-37264). Routes by HTTP status:
   *   - 200 → approved (full {@link CipherResponse} body + optional lease id header)
   *   - 202 → pending  ({@link LeaseRequestResponse}-shaped body)
   *   - 403 → denied   ({ Reason: string } body)
   *
   * Does not go through `apiService.send` because that path rejects every
   * non-200 with an {@link ErrorResponse} (dropping the body, so a 202 carrying
   * a {@link LeaseRequestResponse} cannot be reconstructed) and calls
   * `logoutCallback("invalidAccessToken")` on any authenticated 403, which
   * would log the user out on every "denied" verdict. We instead use
   * {@link ApiService.fetch}, which is just the platform-headered pipeline
   * around the native `fetch`, and surface the raw {@link Response}.
   */
  async fetchGatedCipher(id: string): Promise<GatedCipherFetchResult> {
    if (this.environmentService == null || this.accountService == null) {
      // Surface a clear error when DI didn't provide the collaborators the
      // gated round-trip needs. The other PAM endpoints don't depend on them,
      // so callers that only exercise them remain unaffected.
      throw new Error(
        "fetchGatedCipher requires EnvironmentService and AccountService; see PM-37264",
      );
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const accessToken = await this.apiService.getActiveBearerToken(userId);
    const environment = await firstValueFrom(this.environmentService.getEnvironment$(userId));
    const url = environment.getApiUrl() + `/ciphers/${encodeURIComponent(id)}`;

    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    });

    const response = await this.apiService.fetch(new Request(url, { method: "GET", headers }));

    if (response.status === 200) {
      const body = await readJsonSafely(response);
      return {
        kind: "approved",
        cipher: new CipherResponse(body),
        leaseId: response.headers.get("X-Lease-Id"),
      };
    }

    if (response.status === 202) {
      const body = await readJsonSafely(response);
      return { kind: "pending", request: new LeaseRequestResponse(body) };
    }

    if (response.status === 403) {
      const body = await readJsonSafely(response);
      const reason =
        (body && typeof body === "object" && typeof body.Reason === "string" && body.Reason) || "";
      return { kind: "denied", reason };
    }

    // Any other status is unexpected for the gated endpoint; surface it.
    throw new Error(`Unexpected status ${response.status} from gated cipher fetch`);
  }

  async patchLeaseRequest(
    id: string,
    request: LeaseRequestPatchRequest,
  ): Promise<LeaseRequestResponse> {
    return new LeaseRequestResponse(
      await this.send("PATCH", `/leasing/requests/${id}`, request, true),
    );
  }

  async cancelLeaseRequest(id: string): Promise<void> {
    await this.send("DELETE", `/leasing/requests/${id}`, null, false);
  }

  async requestLeaseExtension(request: LeaseExtensionRequest): Promise<LeaseRequestResponse> {
    return new LeaseRequestResponse(
      await this.send("POST", "/leasing/requests/extension", request, true),
    );
  }

  async decideLeaseRequest(
    id: string,
    request: LeaseDecisionRequest,
  ): Promise<LeaseRequestResponse> {
    return new LeaseRequestResponse(
      await this.send("POST", `/leasing/requests/${id}/decision`, request, true),
    );
  }

  async revokeLease(id: string, request: LeaseRevokeRequest): Promise<void> {
    await this.send("POST", `/leasing/leases/${id}/revoke`, request, false);
  }

  async setCollectionLeasingConfig(
    id: string,
    request: CollectionLeasingRequest,
  ): Promise<CollectionLeasingConfigResponse> {
    return new CollectionLeasingConfigResponse(
      await this.send("PUT", `/collections/${id}/leasing`, request, true),
    );
  }

  private send(method: HttpMethod, path: string, body: unknown, hasResponse: boolean) {
    return this.apiService.send(method, path, body, true, hasResponse);
  }
}

/**
 * Tolerantly read a JSON body. Returns `null` if the body is missing, not
 * JSON-typed, or fails to parse — callers must handle that shape.
 */
async function readJsonSafely(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}
