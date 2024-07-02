import { CommonModule, Location } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Params } from "@angular/router";
import { map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { AsyncActionsModule, ButtonModule, SearchModule } from "@bitwarden/components";
import {
  CipherFormConfig,
  CipherFormConfigService,
  CipherFormMode,
  CipherFormModule,
  DefaultCipherFormConfigService,
} from "@bitwarden/vault";

import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";
import { OpenAttachmentsComponent } from "../attachments/open-attachments/open-attachments.component";

/**
 * Helper class to parse query parameters for the AddEdit route.
 */
class QueryParams {
  constructor(params: Params) {
    this.cipherId = params.cipherId;
    this.type = parseInt(params.type, null);
    this.clone = params.clone === "true";
    this.folderId = params.folderId;
    this.organizationId = params.organizationId;
    this.collectionId = params.collectionId;
    this.uri = params.uri;
  }

  /**
   * The ID of the cipher to edit or clone.
   */
  cipherId?: CipherId;

  /**
   * The type of cipher to create.
   */
  type: CipherType;

  /**
   * Whether to clone the cipher.
   */
  clone?: boolean;

  /**
   * Optional folderId to pre-select.
   */
  folderId?: string;

  /**
   * Optional organizationId to pre-select.
   */
  organizationId?: OrganizationId;

  /**
   * Optional collectionId to pre-select.
   */
  collectionId?: CollectionId;

  /**
   * Optional URI to pre-fill for login ciphers.
   */
  uri?: string;
}

export type AddEditQueryParams = Partial<Record<keyof QueryParams, string>>;

@Component({
  selector: "app-add-edit-v2",
  templateUrl: "add-edit-v2.component.html",
  standalone: true,
  providers: [{ provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService }],
  imports: [
    CommonModule,
    SearchModule,
    JslibModule,
    FormsModule,
    ButtonModule,
    OpenAttachmentsComponent,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    CipherFormModule,
    AsyncActionsModule,
  ],
})
export class AddEditV2Component {
  headerText: string;
  config: CipherFormConfig;

  get loading() {
    return this.config == null;
  }

  get originalCipherId(): CipherId | null {
    return this.config?.originalCipher.id as CipherId;
  }

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private i18nService: I18nService,
    private addEditFormConfigService: CipherFormConfigService,
  ) {
    this.subscribeToParams();
  }

  onCipherSaved(savedCipher: CipherView) {
    this.location.back();
  }

  subscribeToParams(): void {
    this.route.queryParams
      .pipe(
        takeUntilDestroyed(),
        map((params) => new QueryParams(params)),
        switchMap(async (params) => {
          let mode: CipherFormMode;
          if (params.cipherId == null) {
            mode = "add";
          } else {
            mode = params.clone ? "clone" : "edit";
          }
          const config = await this.addEditFormConfigService.buildConfig(
            mode,
            params.cipherId,
            params.type,
          );

          if (config.mode === "edit" && !config.originalCipher.edit) {
            config.mode = "partial-edit";
          }

          this.setInitialValuesFromParams(params, config);

          return config;
        }),
      )
      .subscribe((config) => {
        this.config = config;
        this.headerText = this.setHeader(config.mode, config.cipherType);
      });
  }

  setInitialValuesFromParams(params: QueryParams, config: CipherFormConfig) {
    config.initialValues = {};
    if (params.folderId) {
      config.initialValues.folderId = params.folderId;
    }
    if (params.organizationId) {
      config.initialValues.organizationId = params.organizationId;
    }
    if (params.collectionId) {
      config.initialValues.collectionIds = [params.collectionId];
    }
    if (params.uri) {
      config.initialValues.loginUri = params.uri;
    }
  }

  setHeader(mode: CipherFormMode, type: CipherType) {
    const partOne = mode === "edit" || mode === "partial-edit" ? "editItemHeader" : "newItemHeader";

    switch (type) {
      case CipherType.Login:
        return this.i18nService.t(partOne, this.i18nService.t("typeLogin"));
      case CipherType.Card:
        return this.i18nService.t(partOne, this.i18nService.t("typeCard"));
      case CipherType.Identity:
        return this.i18nService.t(partOne, this.i18nService.t("typeIdentity"));
      case CipherType.SecureNote:
        return this.i18nService.t(partOne, this.i18nService.t("note"));
    }
  }
}
