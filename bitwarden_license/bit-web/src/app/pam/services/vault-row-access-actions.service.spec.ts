import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, NEVER, of, Subscription } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import type { AccessRequestId, CipherAccessStateView } from "../abstractions/access-lease";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";

import { AccessRequestCancelService } from "./access-request-cancel.service";
import { DefaultAccessRefreshService } from "./default-access-refresh.service";
import { DefaultVaultRowAccessActionsService } from "./vault-row-access-actions.service";

const CIPHER_ID = "cipher-1";
const REQUEST_ID = "request-1" as unknown as AccessRequestId;

/** A PAM-gated row's cipher, as the vault list hands it over. */
function gatedCipher(id: string | null = CIPHER_ID): CipherViewLike {
  return { id, partial: true } as unknown as CipherViewLike;
}

function plainCipher(): CipherViewLike {
  return { id: CIPHER_ID, partial: false } as unknown as CipherViewLike;
}

function state(overrides: Partial<CipherAccessStateView> = {}): CipherAccessStateView {
  return {
    cipherId: CIPHER_ID,
    activeLease: undefined,
    pendingRequest: undefined,
    approvedRequest: undefined,
    ...overrides,
  } as unknown as CipherAccessStateView;
}

describe("DefaultVaultRowAccessActionsService", () => {
  let requestsApi: MockProxy<AccessRequestSdkService>;
  let cancelService: MockProxy<AccessRequestCancelService>;
  let configService: MockProxy<ConfigService>;
  let accessRefresh: DefaultAccessRefreshService;
  let service: DefaultVaultRowAccessActionsService;
  let subscription: Subscription | undefined;

  beforeEach(() => {
    requestsApi = mock<AccessRequestSdkService>();
    cancelService = mock<AccessRequestCancelService>();
    configService = mock<ConfigService>();
    // No push in these tests: the row menu is exercised through local mutations only.
    accessRefresh = new DefaultAccessRefreshService({
      accessChanged$: () => NEVER,
      approverInboxChanged$: () => NEVER,
    });
    configService.getFeatureFlag$.mockReturnValue(of(true));
    service = new DefaultVaultRowAccessActionsService(
      requestsApi,
      accessRefresh,
      cancelService,
      configService,
    );
  });

  afterEach(() => {
    subscription?.unsubscribe();
    subscription = undefined;
  });

  describe("cancelableRequest$", () => {
    it("emits true when a pending request is outstanding", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        state({ pendingRequest: { id: REQUEST_ID } as never }),
      );

      await expect(firstValueFrom(service.cancelableRequest$(gatedCipher()))).resolves.toBe(true);
    });

    it("emits true when an approved request has not been activated", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        state({ approvedRequest: { id: REQUEST_ID } as never }),
      );

      await expect(firstValueFrom(service.cancelableRequest$(gatedCipher()))).resolves.toBe(true);
    });

    it("emits false when nothing is outstanding", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(state());

      await expect(firstValueFrom(service.cancelableRequest$(gatedCipher()))).resolves.toBe(false);
    });

    it("emits false without reading state for a cipher that is not gated", async () => {
      await expect(firstValueFrom(service.cancelableRequest$(plainCipher()))).resolves.toBe(false);
      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
    });

    it("emits false without reading state for a gated cipher without an id", async () => {
      await expect(firstValueFrom(service.cancelableRequest$(gatedCipher(null)))).resolves.toBe(
        false,
      );
      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
    });

    it("emits false without reading state when the feature flag is off", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));

      await expect(firstValueFrom(service.cancelableRequest$(gatedCipher()))).resolves.toBe(false);
      expect(requestsApi.getCipherAccessState).not.toHaveBeenCalled();
    });

    it("emits false when the state read fails", async () => {
      requestsApi.getCipherAccessState.mockRejectedValue(new Error("boom"));

      await expect(firstValueFrom(service.cancelableRequest$(gatedCipher()))).resolves.toBe(false);
    });

    it("returns the same stream for the same cipher id, as the template contract requires", () => {
      const first = service.cancelableRequest$(gatedCipher());
      const second = service.cancelableRequest$(gatedCipher());

      expect(second).toBe(first);
    });

    it("shares one state read across concurrent subscribers", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        state({ pendingRequest: { id: REQUEST_ID } as never }),
      );
      const state$ = service.cancelableRequest$(gatedCipher());

      subscription = state$.subscribe();
      await expect(firstValueFrom(state$)).resolves.toBe(true);

      expect(requestsApi.getCipherAccessState).toHaveBeenCalledTimes(1);
    });

    it("re-reads the state when the cipher's access changes", async () => {
      requestsApi.getCipherAccessState.mockResolvedValue(
        state({ pendingRequest: { id: REQUEST_ID } as never }),
      );
      const emissions: boolean[] = [];
      subscription = service.cancelableRequest$(gatedCipher()).subscribe((v) => emissions.push(v));
      await new Promise((resolve) => setTimeout(resolve, 0));

      requestsApi.getCipherAccessState.mockResolvedValue(state());
      accessRefresh.notifyAccessChanged(CIPHER_ID);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(emissions).toEqual([true, false]);
    });
  });

  describe("cancelRequest", () => {
    it("hands a gated cipher to the shared cancel flow", async () => {
      await service.cancelRequest(gatedCipher());

      expect(cancelService.cancelOutstandingRequest).toHaveBeenCalledWith(CIPHER_ID);
    });

    it("does nothing for a cipher that is not gated", async () => {
      await service.cancelRequest(plainCipher());

      expect(cancelService.cancelOutstandingRequest).not.toHaveBeenCalled();
    });

    it("does nothing for a gated cipher without an id", async () => {
      await service.cancelRequest(gatedCipher(null));

      expect(cancelService.cancelOutstandingRequest).not.toHaveBeenCalled();
    });
  });
});
