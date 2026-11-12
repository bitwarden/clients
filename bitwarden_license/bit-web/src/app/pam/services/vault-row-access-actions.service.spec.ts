import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { AccessRefreshService, AccessRequestSdkService } from "@bitwarden/bit-pam";
import { AccessRequestCancelService } from "@bitwarden/bit-pam-components";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { DefaultVaultRowAccessActionsService } from "./vault-row-access-actions.service";

describe("DefaultVaultRowAccessActionsService", () => {
  it("withdraws a gated row's outstanding request through the shared cancel service", async () => {
    const cancelService = mock<AccessRequestCancelService>();
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(true));
    const service = new DefaultVaultRowAccessActionsService(
      mock<AccessRequestSdkService>(),
      mock<AccessRefreshService>(),
      cancelService,
      configService,
    );
    const cipher = { id: "cipher-1", partial: true } as unknown as CipherViewLike;

    await service.cancelRequest(cipher);

    expect(cancelService.cancelOutstandingRequest).toHaveBeenCalledWith("cipher-1");
  });

  it("offers nothing for an ungated row", async () => {
    const service = new DefaultVaultRowAccessActionsService(
      mock<AccessRequestSdkService>(),
      mock<AccessRefreshService>(),
      mock<AccessRequestCancelService>(),
      mock<ConfigService>(),
    );
    const cipher = { id: "cipher-1", partial: false } as unknown as CipherViewLike;

    expect(await firstValueFrom(service.cancelableRequest$(cipher))).toBe(false);
  });
});
