import { inject, Injectable } from "@angular/core";
import { combineLatest, firstValueFrom, map } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUserStatusType, PolicyType } from "@bitwarden/common/admin-console/enums";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

import {
  CipherFormConfig,
  CipherFormConfigService,
  CipherFormMode,
} from "../abstractions/cipher-form-config.service";

/**
 * Default implementation of the `CipherFormConfigService`. This service should suffice for most use cases, however
 * the admin console may need to provide a custom implementation to support admin/custom users who have access to
 * collections that are not part of their normal sync data.
 */
@Injectable()
export class DefaultCipherFormConfigService implements CipherFormConfigService {
  private policyService: PolicyService = inject(PolicyService);
  private organizationService: OrganizationService = inject(OrganizationService);
  private cipherService: CipherService = inject(CipherService);
  private folderService: FolderService = inject(FolderService);
  private collectionService: CollectionService = inject(CollectionService);

  async buildConfig(
    mode: CipherFormMode,
    cipherId?: CipherId,
    cipherType?: CipherType,
  ): Promise<CipherFormConfig> {
    const [organizations, collections, allowPersonalOwnership, folders, cipher] =
      await firstValueFrom(
        combineLatest([
          this.organizations$,
          this.collectionService.decryptedCollections$,
          this.allowPersonalOwnership$,
          this.folderService.folderViews$,
          this.getCipher(cipherId),
        ]),
      );

    return {
      mode,
      cipherType,
      admin: false,
      allowPersonalOwnership,
      originalCipher: cipher,
      collections,
      organizations,
      folders,
    };
  }

  private organizations$ = this.organizationService.organizations$.pipe(
    map((orgs) =>
      orgs.filter(
        (o) => o.isMember && o.enabled && o.status === OrganizationUserStatusType.Confirmed,
      ),
    ),
  );

  private allowPersonalOwnership$ = this.policyService
    .policyAppliesToActiveUser$(PolicyType.PersonalOwnership)
    .pipe(map((p) => !p));

  private getCipher(id?: CipherId): Promise<Cipher | null> {
    if (id == null) {
      return Promise.resolve(null);
    }
    return this.cipherService.get(id);
  }
}
