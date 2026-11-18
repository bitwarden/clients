import { NgZone } from "@angular/core";
import { LoadChildrenCallback } from "@angular/router";

import {
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
} from "@bitwarden/bit-pam";
import {
  AccessBadgeTickerService,
  CipherViewBannerComponent,
  GatedRequestActionsService,
  GovernedSharedFolderIconComponent,
  ItemDetailsStateBadgeComponent,
  LeaseExtensionService,
  controlledAccessColumn,
} from "@bitwarden/bit-pam-components";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { PAM_DESKTOP_ROUTES } from "@bitwarden/desktop/app/pam/pam-routes.token";
import { VAULT_GATED_COLLECTION_BANNER } from "@bitwarden/desktop/vault/app/vault-v3/vault-gated-collection-banner.token";
import {
  CIPHER_VIEW_BANNER,
  ITEM_DETAILS_BADGE,
  SHARED_FOLDER_DECORATION,
  VAULT_ITEM_COLUMN,
  VAULT_ROW_ACTIONS,
} from "@bitwarden/vault";

import { DesktopAccessBadgeTickerService } from "./desktop-access-badge-ticker.service";
import { provideDesktopPam } from "./provide-pam";
import { DesktopGatedCollectionBannerComponent } from "./vault/desktop-gated-collection-banner.component";
import { DesktopLeasedClipboardService } from "./vault/desktop-leased-clipboard.service";
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
    it("fills the gated shared-folder banner with the desktop banner, which explains a missing license", () => {
      expect(providerFor(VAULT_GATED_COLLECTION_BANNER)?.useValue).toBe(
        DesktopGatedCollectionBannerComponent,
      );
    });

    it("fills the shared-folder decoration with the shared lock component", () => {
      expect(providerFor(SHARED_FOLDER_DECORATION)?.useValue).toBe(
        GovernedSharedFolderIconComponent,
      );
    });

    it("fills the cipher-view banner and item badge with the shared components, which block an unlicensed member", () => {
      expect(providerFor(CIPHER_VIEW_BANNER)?.useValue).toBe(CipherViewBannerComponent);
      expect(providerFor(ITEM_DETAILS_BADGE)?.useValue).toBe(ItemDetailsStateBadgeComponent);
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
        DesktopAccessBadgeTickerService,
        AccessLeaseSdkService,
        AccountService,
        AuthService,
        NgZone,
        LogService,
        DesktopLeasedClipboardService,
      ]);
    });

    it("provides the clipboard guard with the copy stream and clipboard access", () => {
      const provider = providerFor(DesktopLeasedClipboardService);

      expect(provider?.useClass).toBe(DesktopLeasedClipboardService);
      expect(provider?.deps).toEqual([
        MessageListener,
        PlatformUtilsService,
        TotpService,
        LogService,
      ]);
    });

    it("serves the shared ticker from the desktop lease clock", () => {
      expect(providerFor(DesktopAccessBadgeTickerService)?.useClass).toBe(
        DesktopAccessBadgeTickerService,
      );
      expect(providerFor(AccessBadgeTickerService)?.useExisting).toBe(
        DesktopAccessBadgeTickerService,
      );
    });

    it("provides the services the request and lease flows inject", () => {
      expect(providerFor(GatedRequestActionsService)).toBeDefined();
      expect(providerFor(LeaseExtensionService)).toBeDefined();
    });
  });
});
