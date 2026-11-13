import { NgZone } from "@angular/core";
import { LoadChildrenCallback } from "@angular/router";

import {
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
} from "@bitwarden/bit-pam";
import {
  AccessBadgeTickerService,
  GatedCollectionBannerComponent,
  GatedRequestActionsService,
  LeaseExtensionService,
  controlledAccessColumn,
} from "@bitwarden/bit-pam-components";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { PAM_DESKTOP_ROUTES } from "@bitwarden/desktop/app/pam/pam-routes.token";
import { VAULT_GATED_COLLECTION_BANNER } from "@bitwarden/desktop/vault/app/vault-v3/vault-gated-collection-banner.token";
import { VAULT_ITEM_COLUMN, VAULT_ROW_ACTIONS } from "@bitwarden/vault";

import { provideDesktopPam } from "./provide-pam";
import { DesktopRevealedCipherService } from "./vault/desktop-revealed-cipher.service";
import { DesktopVaultRowActionsService } from "./vault/desktop-vault-row-actions.service";

function providerFor(token: unknown): Record<string, unknown> | undefined {
  return provideDesktopPam().find(
    (p) => (p as { provide: unknown }).provide === token,
  ) as unknown as Record<string, unknown> | undefined;
}

describe("provideDesktopPam", () => {
  it("fills the PAM route seam with the shell routes", async () => {
    const provider = provideDesktopPam().find(
      (p) => (p as { provide: unknown }).provide === PAM_DESKTOP_ROUTES,
    ) as unknown as { useValue: LoadChildrenCallback };

    const routes = (await (provider.useValue as () => Promise<unknown>)()) as {
      path: string;
      children: { path: string }[];
    }[];

    expect(routes[0].path).toBe("");
    expect(routes[0].children.map((c) => c.path)).toEqual([
      "",
      "approvals",
      "my-requests",
      "history",
      "requests/:id",
    ]);
  });

  describe("vault seams", () => {
    it("fills the gated shared-folder banner with the shared banner component", () => {
      expect(providerFor(VAULT_GATED_COLLECTION_BANNER)?.useValue).toBe(
        GatedCollectionBannerComponent,
      );
    });

    it("fills the Controlled access column from the shared column factory", () => {
      expect(providerFor(VAULT_ITEM_COLUMN)?.useFactory).toBe(controlledAccessColumn);
    });

    it("fills the row menu with the desktop row actions", () => {
      const provider = providerFor(VAULT_ROW_ACTIONS) as {
        useFactory: (service: DesktopVaultRowActionsService) => unknown;
        deps: unknown[];
      };
      const actions = [{ id: "pamCancelRequest" }];
      const rowActions = jest.fn().mockReturnValue(actions);

      const result = provider.useFactory({
        rowActions,
      } as unknown as DesktopVaultRowActionsService);

      expect(provider.deps).toEqual([DesktopVaultRowActionsService]);
      expect(result).toBe(actions);
    });

    it("fills the revealed-cipher seam with the desktop service and its dependencies", () => {
      const provider = providerFor(RevealedCipherService);

      expect(provider?.useClass).toBe(DesktopRevealedCipherService);
      expect(provider?.deps).toEqual([
        AccessRequestSdkService,
        AccessRefreshService,
        AccessBadgeTickerService,
        AccessLeaseSdkService,
        AccountService,
        AuthService,
        NgZone,
        LogService,
      ]);
    });

    it("provides the services the request and lease flows inject", () => {
      expect(providerFor(GatedRequestActionsService)).toBeDefined();
      expect(providerFor(LeaseExtensionService)).toBeDefined();
    });
  });
});
