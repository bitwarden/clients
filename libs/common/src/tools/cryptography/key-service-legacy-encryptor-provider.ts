// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  connect,
  dematerialize,
  map,
  materialize,
  ReplaySubject,
  skipWhile,
  switchMap,
  takeUntil,
  takeWhile,
} from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { OrganizationId, UserId } from "../../types/guid";
import {
  OrganizationBound,
  SingleOrganizationDependency,
  SingleUserDependency,
  UserBound,
} from "../dependencies";
import { anyComplete, errorOnChange } from "../rx";
import { PaddedDataPacker } from "../state/padded-data-packer";

import { LegacyEncryptorProvider } from "./legacy-encryptor-provider";
import { OrganizationEncryptor } from "./organization-encryptor.abstraction";
import { OrganizationKeyEncryptor } from "./organization-key-encryptor";
import { UserEncryptor } from "./user-encryptor.abstraction";
import { UserKeyEncryptor } from "./user-key-encryptor";

/** Creates encryptors
 */
export class KeyServiceLegacyEncryptorProvider implements LegacyEncryptorProvider {
  /** Instantiates the legacy encryptor provider.
   *  @param encryptService injected into encryptors to perform encryption
   *  @param keyService looks up keys for construction into an encryptor
   */
  constructor(
    private readonly encryptService: EncryptService,
    private readonly keyService: KeyService,
  ) {}

  userEncryptor$(frameSize: number, dependencies: SingleUserDependency) {
    const packer = new PaddedDataPacker(frameSize);
    const encryptor$ = dependencies.singleUserId$.pipe(
      errorOnChange(
        (userId) => userId,
        (expectedUserId, actualUserId) => ({ expectedUserId, actualUserId }),
      ),
      connect((singleUserId$) => {
        const singleUserId = new ReplaySubject<UserId>(1);
        singleUserId$.subscribe(singleUserId);

        return singleUserId.pipe(
          switchMap((userId) =>
            this.keyService.userKey$(userId).pipe(
              // wait until the key becomes available
              skipWhile((key) => !key),
              // complete when the key becomes unavailable
              takeWhile((key) => !!key),
              map((key) => {
                const encryptor = new UserKeyEncryptor(userId, this.encryptService, key, packer);

                return { userId, encryptor } satisfies UserBound<"encryptor", UserEncryptor>;
              }),
              materialize(),
            ),
          ),
          dematerialize(),
          takeUntil(anyComplete(singleUserId)),
        );
      }),
    );

    return encryptor$;
  }

  organizationEncryptor$(frameSize: number, dependencies: SingleOrganizationDependency) {
    const packer = new PaddedDataPacker(frameSize);
    const encryptor$ = dependencies.singleOrganizationId$.pipe(
      errorOnChange(
        (pair) => pair.userId,
        (expectedUserId, actualUserId) => ({ expectedUserId, actualUserId }),
      ),
      errorOnChange(
        (pair) => pair.organizationId,
        (expectedOrganizationId, actualOrganizationId) => ({
          expectedOrganizationId,
          actualOrganizationId,
        }),
      ),
      connect((singleOrganizationId$) => {
        const singleOrganizationId = new ReplaySubject<UserBound<"organizationId", OrganizationId>>(
          1,
        );
        singleOrganizationId$.subscribe(singleOrganizationId);

        return singleOrganizationId.pipe(
          switchMap((pair) =>
            this.keyService.orgKeys$(pair.userId).pipe(
              // wait until the key becomes available
              skipWhile((keys) => !keys),
              // complete when the key becomes unavailable
              takeWhile((keys) => !!keys),
              map((keys) => {
                const organizationId = pair.organizationId;
                const key = keys[organizationId];
                const encryptor = new OrganizationKeyEncryptor(
                  organizationId,
                  this.encryptService,
                  key,
                  packer,
                );

                return { organizationId, encryptor } satisfies OrganizationBound<
                  "encryptor",
                  OrganizationEncryptor
                >;
              }),
              materialize(),
            ),
          ),
          dematerialize(),
          takeUntil(anyComplete(singleOrganizationId)),
        );
      }),
    );

    return encryptor$;
  }
}
