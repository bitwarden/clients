import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { KeyServiceLegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/key-service-legacy-encryptor-provider";
import { LegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/legacy-encryptor-provider";
import { ExtensionRegistry } from "@bitwarden/common/tools/extension/extension-registry.abstraction";
import { buildExtensionRegistry } from "@bitwarden/common/tools/extension/factory";
import {
  createSystemServiceProvider,
  SystemServiceProvider,
} from "@bitwarden/common/tools/providers";
import { DialogRef, AsyncActionsModule, ButtonModule, DialogModule } from "@bitwarden/components";
import { ImportMetadataServiceAbstraction } from "@bitwarden/importer-core";
import { ImportComponent } from "@bitwarden/importer-ui";
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { StateProvider } from "@bitwarden/state";
import { SafeInjectionToken, safeProvider } from "@bitwarden/ui-common";

import { DesktopImportMetadataService } from "./desktop-import-metadata.service";

// FIXME: unify with `SYSTEM_SERVICE_PROVIDER` when migrating it from the generator component module
//        to a general module.
const SYSTEM_SERVICE_PROVIDER = new SafeInjectionToken<SystemServiceProvider>("SystemServices");

@Component({
  templateUrl: "import-desktop.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    AsyncActionsModule,
    ButtonModule,
    ImportComponent,
  ],
  providers: [
    safeProvider({
      provide: LegacyEncryptorProvider,
      useClass: KeyServiceLegacyEncryptorProvider,
      deps: [EncryptService, KeyService],
    }),
    safeProvider({
      provide: ExtensionRegistry,
      useFactory: () => {
        return buildExtensionRegistry();
      },
      deps: [],
    }),
    safeProvider({
      provide: SYSTEM_SERVICE_PROVIDER,
      useFactory: createSystemServiceProvider,
      deps: [
        LegacyEncryptorProvider,
        StateProvider,
        PolicyService,
        ExtensionRegistry,
        LogService,
        PlatformUtilsService,
        ConfigService,
      ],
    }),
    {
      provide: ImportMetadataServiceAbstraction,
      useClass: DesktopImportMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER],
    },
  ],
})
export class ImportDesktopComponent {
  protected disabled = false;
  protected loading = false;

  constructor(public dialogRef: DialogRef) {}

  /**
   * Callback that is called after a successful import.
   */
  protected async onSuccessfulImport(organizationId: string): Promise<void> {
    this.dialogRef.close();
  }

  protected onLoadProfilesFromBrowser(browser: string): Promise<any[]> {
    return ipc.tools.chromiumImporter.getAvailableProfiles(browser);
  }

  protected onImportFromBrowser(browser: string, profile: string): Promise<any[]> {
    return ipc.tools.chromiumImporter.importLogins(browser, profile);
  }
}
