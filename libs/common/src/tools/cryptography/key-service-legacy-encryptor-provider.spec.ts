import { mock } from "jest-mock-extended";
import { BehaviorSubject, Subject } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { OrganizationId, UserId } from "../../types/guid";
import { OrgKey, UserKey } from "../../types/key";
import { OrganizationBound, UserBound } from "../dependencies";

import { KeyServiceLegacyEncryptorProvider } from "./key-service-legacy-encryptor-provider";
import { OrganizationEncryptor } from "./organization-encryptor.abstraction";
import { OrganizationKeyEncryptor } from "./organization-key-encryptor";
import { UserEncryptor } from "./user-encryptor.abstraction";
import { UserKeyEncryptor } from "./user-key-encryptor";

const encryptService = mock<EncryptService>();
const keyService = mock<KeyService>();

const SomeCsprngArray = new Uint8Array(64) as CsprngArray;
const SomeUser = "some user" as UserId;
const AnotherUser = "another user" as UserId;
const SomeUserKey = new SymmetricCryptoKey(SomeCsprngArray) as UserKey;
const SomeOrganization = "some organization" as OrganizationId;
const AnotherOrganization = "another organization" as OrganizationId;
const SomeOrgKey = new SymmetricCryptoKey(SomeCsprngArray) as OrgKey;
const AnotherOrgKey = new SymmetricCryptoKey(SomeCsprngArray) as OrgKey;
const OrgRecords: Record<OrganizationId, OrgKey> = {
  [SomeOrganization]: SomeOrgKey,
  [AnotherOrganization]: AnotherOrgKey,
};

// Many tests examine the private members of the objects constructed by the
// provider. This is necessary because it's not presently possible to spy
// on the constructors directly.
describe("KeyServiceLegacyEncryptorProvider", () => {
  describe("userEncryptor$", () => {
    it("emits a user key encryptor bound to the user", async () => {
      const userKey$ = new BehaviorSubject<UserKey>(SomeUserKey);
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new BehaviorSubject<UserId>(SomeUser);
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      const results: UserBound<"encryptor", UserEncryptor>[] = [];

      provider.userEncryptor$(1, { singleUserId$ }).subscribe((v) => results.push(v));

      expect(keyService.userKey$).toHaveBeenCalledWith(SomeUser);
      expect(results.length).toBe(1);
      expect(results[0]).toMatchObject({
        userId: SomeUser,
        encryptor: {
          userId: SomeUser,
          key: SomeUserKey,
          dataPacker: { frameSize: 1 },
        },
      });
      expect(results[0].encryptor).toBeInstanceOf(UserKeyEncryptor);
    });

    it("waits until `dependencies.singleUserId$` emits", () => {
      const userKey$ = new BehaviorSubject<UserKey>(SomeUserKey);
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new Subject<UserId>();
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      const results: UserBound<"encryptor", UserEncryptor>[] = [];
      provider.userEncryptor$(1, { singleUserId$ }).subscribe((v) => results.push(v));
      // precondition: no emissions occur on subscribe
      expect(results.length).toBe(0);

      singleUserId$.next(SomeUser);

      expect(results.length).toBe(1);
    });

    it("emits a new user key encryptor each time `dependencies.singleUserId$` emits", () => {
      const userKey$ = new BehaviorSubject<UserKey>(SomeUserKey);
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new Subject<UserId>();
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      const results: UserBound<"encryptor", UserEncryptor>[] = [];
      provider.userEncryptor$(1, { singleUserId$ }).subscribe((v) => results.push(v));

      singleUserId$.next(SomeUser);
      singleUserId$.next(SomeUser);

      expect(results.length).toBe(2);
      expect(results[0]).not.toBe(results[1]);
    });

    it("waits until `userKey$` emits a truthy value", () => {
      const userKey$ = new BehaviorSubject<UserKey>(null);
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new BehaviorSubject<UserId>(SomeUser);
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      const results: UserBound<"encryptor", UserEncryptor>[] = [];
      provider.userEncryptor$(1, { singleUserId$ }).subscribe((v) => results.push(v));
      // precondition: no emissions occur on subscribe
      expect(results.length).toBe(0);

      userKey$.next(SomeUserKey);

      expect(results.length).toBe(1);
      expect(results[0]).toMatchObject({
        userId: SomeUser,
        encryptor: {
          userId: SomeUser,
          key: SomeUserKey,
          dataPacker: { frameSize: 1 },
        },
      });
    });

    it("emits a user key encryptor each time `userKey$` emits", () => {
      const userKey$ = new Subject<UserKey>();
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new BehaviorSubject<UserId>(SomeUser);
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      const results: UserBound<"encryptor", UserEncryptor>[] = [];
      provider.userEncryptor$(1, { singleUserId$ }).subscribe((v) => results.push(v));

      userKey$.next(SomeUserKey);
      userKey$.next(SomeUserKey);

      expect(results.length).toBe(2);
    });

    it("errors when the userId changes", () => {
      const userKey$ = new BehaviorSubject<UserKey>(SomeUserKey);
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new Subject<UserId>();
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let error: unknown = false;
      provider
        .userEncryptor$(1, { singleUserId$ })
        .subscribe({ error: (e: unknown) => (error = e) });

      singleUserId$.next(SomeUser);
      singleUserId$.next(AnotherUser);

      expect(error).toEqual({ expectedUserId: SomeUser, actualUserId: AnotherUser });
    });

    it("errors when `dependencies.singleUserId$` errors", () => {
      const userKey$ = new BehaviorSubject<UserKey>(SomeUserKey);
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new Subject<UserId>();
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let error: unknown = false;
      provider
        .userEncryptor$(1, { singleUserId$ })
        .subscribe({ error: (e: unknown) => (error = e) });

      singleUserId$.error({ some: "error" });

      expect(error).toEqual({ some: "error" });
    });

    it("errors once `dependencies.singleUserId$` emits and `userKey$` errors", () => {
      const userKey$ = new Subject<UserKey>();
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new BehaviorSubject<UserId>(SomeUser);
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let error: unknown = false;
      provider
        .userEncryptor$(1, { singleUserId$ })
        .subscribe({ error: (e: unknown) => (error = e) });

      userKey$.error({ some: "error" });

      expect(error).toEqual({ some: "error" });
    });

    it("completes when `dependencies.singleUserId$` completes", () => {
      const userKey$ = new Subject<UserKey>();
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new BehaviorSubject<UserId>(SomeUser);
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let completed = false;
      provider
        .userEncryptor$(1, { singleUserId$ })
        .subscribe({ complete: () => (completed = true) });

      singleUserId$.complete();

      expect(completed).toBe(true);
    });

    it("completes when `userKey$` emits a falsy value after emitting a truthy value", () => {
      const userKey$ = new BehaviorSubject<UserKey>(SomeUserKey);
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new BehaviorSubject<UserId>(SomeUser);
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let completed = false;
      provider
        .userEncryptor$(1, { singleUserId$ })
        .subscribe({ complete: () => (completed = true) });

      userKey$.next(null);

      expect(completed).toBe(true);
    });

    it("completes once `dependencies.singleUserId$` emits and `userKey$` completes", () => {
      const userKey$ = new BehaviorSubject<UserKey>(SomeUserKey);
      keyService.userKey$.mockReturnValue(userKey$);
      const singleUserId$ = new BehaviorSubject<UserId>(SomeUser);
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let completed = false;
      provider
        .userEncryptor$(1, { singleUserId$ })
        .subscribe({ complete: () => (completed = true) });

      userKey$.complete();

      expect(completed).toBe(true);
    });
  });

  describe("organizationEncryptor$", () => {
    it("emits an organization key encryptor bound to the organization", () => {
      const orgKey$ = new BehaviorSubject(OrgRecords);
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new BehaviorSubject<
        UserBound<"organizationId", OrganizationId>
      >({
        organizationId: SomeOrganization,
        userId: SomeUser,
      });
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      const results: OrganizationBound<"encryptor", OrganizationEncryptor>[] = [];

      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe((v) => results.push(v));

      expect(keyService.orgKeys$).toHaveBeenCalledWith(SomeUser);
      expect(results.length).toBe(1);
      expect(results[0]).toMatchObject({
        organizationId: SomeOrganization,
        encryptor: {
          organizationId: SomeOrganization,
          key: SomeOrgKey,
          dataPacker: { frameSize: 1 },
        },
      });
      expect(results[0].encryptor).toBeInstanceOf(OrganizationKeyEncryptor);
    });

    it("waits until `dependencies.singleOrganizationId$` emits", () => {
      const orgKey$ = new BehaviorSubject(OrgRecords);
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new Subject<UserBound<"organizationId", OrganizationId>>();
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      const results: OrganizationBound<"encryptor", OrganizationEncryptor>[] = [];
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe((v) => results.push(v));
      // precondition: no emissions occur on subscribe
      expect(results.length).toBe(0);

      singleOrganizationId$.next({
        organizationId: SomeOrganization,
        userId: SomeUser,
      });

      expect(results.length).toBe(1);
    });

    it("emits a new organization key encryptor when `dependencies.singleOrganizationId$` emits", () => {
      const orgKey$ = new BehaviorSubject(OrgRecords);
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new Subject<UserBound<"organizationId", OrganizationId>>();
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      const results: OrganizationBound<"encryptor", OrganizationEncryptor>[] = [];
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe((v) => results.push(v));
      // precondition: no emissions occur on subscribe
      expect(results.length).toBe(0);

      singleOrganizationId$.next({
        organizationId: SomeOrganization,
        userId: SomeUser,
      });
      singleOrganizationId$.next({
        organizationId: SomeOrganization,
        userId: SomeUser,
      });

      expect(results.length).toBe(2);
      expect(results[0]).not.toBe(results[1]);
    });

    it("waits until `orgKeys$` emits a truthy value", () => {
      const orgKey$ = new BehaviorSubject<Record<OrganizationId, OrgKey>>(null);
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new BehaviorSubject<
        UserBound<"organizationId", OrganizationId>
      >({
        organizationId: SomeOrganization,
        userId: SomeUser,
      });
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      const results: OrganizationBound<"encryptor", OrganizationEncryptor>[] = [];
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe((v) => results.push(v));
      // precondition: no emissions occur on subscribe
      expect(results.length).toBe(0);

      orgKey$.next(OrgRecords);

      expect(results.length).toBe(1);
      expect(results[0]).toMatchObject({
        organizationId: SomeOrganization,
        encryptor: {
          organizationId: SomeOrganization,
          key: SomeOrgKey,
          dataPacker: { frameSize: 1 },
        },
      });
    });

    it("emits an organization key encryptor each time `orgKeys$` emits", () => {
      const orgKey$ = new Subject<Record<OrganizationId, OrgKey>>();
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new BehaviorSubject<
        UserBound<"organizationId", OrganizationId>
      >({
        organizationId: SomeOrganization,
        userId: SomeUser,
      });
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      const results: OrganizationBound<"encryptor", OrganizationEncryptor>[] = [];
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe((v) => results.push(v));

      orgKey$.next(OrgRecords);
      orgKey$.next(OrgRecords);

      expect(results.length).toBe(2);
    });

    it("errors when the userId changes", () => {
      const orgKey$ = new BehaviorSubject(OrgRecords);
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new Subject<UserBound<"organizationId", OrganizationId>>();
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let error: unknown = false;
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe({ error: (e: unknown) => (error = e) });

      singleOrganizationId$.next({ userId: SomeUser, organizationId: SomeOrganization });
      singleOrganizationId$.next({ userId: AnotherUser, organizationId: SomeOrganization });

      expect(error).toEqual({ expectedUserId: SomeUser, actualUserId: AnotherUser });
    });

    it("errors when the organizationId changes", () => {
      const orgKey$ = new BehaviorSubject(OrgRecords);
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new Subject<UserBound<"organizationId", OrganizationId>>();
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let error: unknown = false;
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe({ error: (e: unknown) => (error = e) });

      singleOrganizationId$.next({ userId: SomeUser, organizationId: SomeOrganization });
      singleOrganizationId$.next({ userId: SomeUser, organizationId: AnotherOrganization });

      expect(error).toEqual({
        expectedOrganizationId: SomeOrganization,
        actualOrganizationId: AnotherOrganization,
      });
    });

    it("errors when `dependencies.singleOrganizationId$` errors", () => {
      const orgKey$ = new BehaviorSubject(OrgRecords);
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new Subject<UserBound<"organizationId", OrganizationId>>();
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let error: unknown = false;
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe({ error: (e: unknown) => (error = e) });

      singleOrganizationId$.error({ some: "error" });

      expect(error).toEqual({ some: "error" });
    });

    it("errors once `dependencies.singleOrganizationId$` emits and `orgKeys$` errors", () => {
      const orgKey$ = new Subject<Record<OrganizationId, OrgKey>>();
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new BehaviorSubject<
        UserBound<"organizationId", OrganizationId>
      >({
        organizationId: SomeOrganization,
        userId: SomeUser,
      });
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let error: unknown = false;
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe({ error: (e: unknown) => (error = e) });

      orgKey$.error({ some: "error" });

      expect(error).toEqual({ some: "error" });
    });

    it("errors when the user lacks the requested org key", () => {
      const orgKey$ = new BehaviorSubject<Record<OrganizationId, OrgKey>>({});
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new BehaviorSubject<
        UserBound<"organizationId", OrganizationId>
      >({
        organizationId: SomeOrganization,
        userId: SomeUser,
      });
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let error: unknown = false;

      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe({ error: (e: unknown) => (error = e) });

      expect(error).toBeInstanceOf(Error);
    });

    it("completes when `dependencies.singleOrganizationId$` completes", () => {
      const orgKey$ = new BehaviorSubject(OrgRecords);
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new Subject<UserBound<"organizationId", OrganizationId>>();
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let completed = false;
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe({ complete: () => (completed = true) });

      singleOrganizationId$.complete();

      expect(completed).toBe(true);
    });

    it("completes when `orgKeys$` emits a falsy value after emitting a truthy value", () => {
      const orgKey$ = new Subject<Record<OrganizationId, OrgKey>>();
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new BehaviorSubject<
        UserBound<"organizationId", OrganizationId>
      >({
        organizationId: SomeOrganization,
        userId: SomeUser,
      });
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let completed = false;
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe({ complete: () => (completed = true) });

      orgKey$.next(OrgRecords);
      orgKey$.next(null);

      expect(completed).toBe(true);
    });

    it("completes once `dependencies.singleOrganizationId$` emits and `userKey$` completes", () => {
      const orgKey$ = new Subject<Record<OrganizationId, OrgKey>>();
      keyService.orgKeys$.mockReturnValue(orgKey$);
      const singleOrganizationId$ = new BehaviorSubject<
        UserBound<"organizationId", OrganizationId>
      >({
        organizationId: SomeOrganization,
        userId: SomeUser,
      });
      const provider = new KeyServiceLegacyEncryptorProvider(encryptService, keyService);
      let completed = false;
      provider
        .organizationEncryptor$(1, { singleOrganizationId$ })
        .subscribe({ complete: () => (completed = true) });

      orgKey$.complete();

      expect(completed).toBe(true);
    });
  });
});
