import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subject, Subscription } from "rxjs";

import { AccessLeaseSdkService, AccessRefreshService } from "@bitwarden/bit-common/pam";
import type { AccessLeaseView } from "@bitwarden/bit-common/pam";
import { AccessBadgeTickerService } from "@bitwarden/bit-common/pam/access-state-badge/access-badge-ticker.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { PopupLeasedCipherService } from "./popup-leased-cipher.service";

const USER_ID = "user-1" as UserId;
const OTHER_USER_ID = "user-2" as UserId;
const CIPHER_ID = "cipher-1";

function lease(overrides: Partial<Record<keyof AccessLeaseView, unknown>> = {}): AccessLeaseView {
  return {
    id: "lease-1",
    cipherId: CIPHER_ID,
    status: "active",
    notBefore: new Date(Date.now() - 60_000).toISOString(),
    notAfter: new Date(Date.now() + 30 * 60_000).toISOString(),
    ...overrides,
  } as unknown as AccessLeaseView;
}

function cipherResponse(partialData?: string): CipherResponse {
  return {
    id: CIPHER_ID,
    type: 1,
    name: "2.abc|def|ghi",
    revisionDate: "2026-08-17T09:00:00.000Z",
    creationDate: "2026-08-01T09:00:00.000Z",
    collectionIds: [],
    partialData,
  } as unknown as CipherResponse;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("PopupLeasedCipherService", () => {
  let leasesApi: MockProxy<AccessLeaseSdkService>;
  let apiService: MockProxy<ApiService>;
  let cipherService: MockProxy<CipherService>;
  let accessChanged: Subject<void>;
  let activeAccount: BehaviorSubject<{ id: UserId } | null>;
  let authStatus: BehaviorSubject<AuthenticationStatus>;
  let pamFlag: BehaviorSubject<boolean>;
  let organizations: BehaviorSubject<Organization[]>;
  let ticks: Subject<number>;
  let service: PopupLeasedCipherService;
  let subscription: Subscription | undefined;

  function collect(userId = USER_ID): Array<ReadonlyMap<string, CipherView>> {
    const emissions: Array<ReadonlyMap<string, CipherView>> = [];
    subscription = service.leasedCipherViews$(userId).subscribe((views) => emissions.push(views));
    return emissions;
  }

  beforeEach(() => {
    leasesApi = mock<AccessLeaseSdkService>();
    apiService = mock<ApiService>();
    cipherService = mock<CipherService>();
    cipherService.decrypt.mockImplementation(async (cipher: Cipher) => {
      const view = new CipherView();
      view.id = cipher.id;
      return view;
    });
    accessChanged = new Subject<void>();
    activeAccount = new BehaviorSubject<{ id: UserId } | null>({ id: USER_ID });
    authStatus = new BehaviorSubject(AuthenticationStatus.Unlocked);
    pamFlag = new BehaviorSubject(true);
    organizations = new BehaviorSubject([{ canAccessPrivilegedAccess: true } as Organization]);
    ticks = new Subject<number>();

    TestBed.configureTestingModule({
      providers: [
        { provide: AccessLeaseSdkService, useValue: leasesApi },
        { provide: AccessRefreshService, useValue: { accessChanged$: () => accessChanged } },
        { provide: AccountService, useValue: { activeAccount$: activeAccount } },
        { provide: AuthService, useValue: { authStatusFor$: () => authStatus } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => pamFlag } },
        { provide: ApiService, useValue: apiService },
        { provide: CipherService, useValue: cipherService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: AccessBadgeTickerService, useValue: { ticks$: ticks } },
      ],
    });
    service = TestBed.inject(PopupLeasedCipherService);
  });

  afterEach(() => {
    subscription?.unsubscribe();
    subscription = undefined;
  });

  function last(emissions: Array<ReadonlyMap<string, CipherView>>) {
    return emissions[emissions.length - 1];
  }

  it("provides the decrypted full view, marked leaseGated, for an active lease", async () => {
    leasesApi.listMyLeases.mockResolvedValue([lease()]);
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    const emissions = collect();
    await settle();

    const view = last(emissions).get(CIPHER_ID);
    expect(view).toBeInstanceOf(CipherView);
    expect(view?.leaseGated).toBe(true);
    expect(apiService.getFullCipherDetails).toHaveBeenCalledWith(CIPHER_ID);
    expect(cipherService.decrypt).toHaveBeenCalledWith(expect.any(Cipher), USER_ID);
  });

  it("discovers leases with one list read, and fetches only ciphers with an active lease", async () => {
    leasesApi.listMyLeases.mockResolvedValue([
      lease(),
      lease({ id: "lease-2", cipherId: "cipher-2", status: "expired" }),
      lease({ id: "lease-3", cipherId: "cipher-3", notAfter: new Date(0).toISOString() }),
    ]);
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    collect();
    await settle();

    expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(1);
    expect(apiService.getFullCipherDetails).toHaveBeenCalledTimes(1);
    expect(apiService.getFullCipherDetails).toHaveBeenCalledWith(CIPHER_ID);
  });

  it("shares one read between subscribers", async () => {
    leasesApi.listMyLeases.mockResolvedValue([lease()]);
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    collect();
    const second = service.leasedCipherViews$(USER_ID).subscribe();
    await settle();
    second.unsubscribe();

    expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(1);
  });

  it("keeps the cipher out when the server still returns the restricted shape", async () => {
    leasesApi.listMyLeases.mockResolvedValue([lease()]);
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse('{"name":"gated"}'));

    const emissions = collect();
    await settle();

    expect(last(emissions).size).toBe(0);
    expect(cipherService.decrypt).not.toHaveBeenCalled();
  });

  it("drops the view once the lease's notAfter passes", async () => {
    const notAfterMs = Date.now() + 5_000;
    leasesApi.listMyLeases.mockResolvedValue([
      lease({ notAfter: new Date(notAfterMs).toISOString() }),
    ]);
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    const emissions = collect();
    await settle();
    expect(last(emissions).has(CIPHER_ID)).toBe(true);

    ticks.next(notAfterMs - 1);
    expect(last(emissions).has(CIPHER_ID)).toBe(true);

    ticks.next(notAfterMs + 1);
    expect(last(emissions).size).toBe(0);
  });

  it("re-evaluates on an access refresh event and drops an ended lease", async () => {
    leasesApi.listMyLeases.mockResolvedValue([lease()]);
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    const emissions = collect();
    await settle();
    expect(last(emissions).has(CIPHER_ID)).toBe(true);

    leasesApi.listMyLeases.mockResolvedValue([lease({ status: "canceled" })]);
    accessChanged.next();
    await settle();

    expect(leasesApi.listMyLeases).toHaveBeenCalledTimes(2);
    expect(last(emissions).size).toBe(0);
  });

  it("reveals a lease started after the first read once access changes", async () => {
    leasesApi.listMyLeases.mockResolvedValue([]);
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    const emissions = collect();
    await settle();
    expect(last(emissions).size).toBe(0);

    leasesApi.listMyLeases.mockResolvedValue([lease()]);
    accessChanged.next();
    await settle();

    expect(last(emissions).get(CIPHER_ID)?.leaseGated).toBe(true);
  });

  it.each([
    ["the vault locks", () => authStatus.next(AuthenticationStatus.Locked)],
    ["the user logs out", () => authStatus.next(AuthenticationStatus.LoggedOut)],
    ["the active account switches", () => activeAccount.next({ id: OTHER_USER_ID })],
  ])("empties when %s", async (_, act) => {
    leasesApi.listMyLeases.mockResolvedValue([lease()]);
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    const emissions = collect();
    await settle();
    expect(last(emissions).size).toBe(1);

    act();
    await settle();

    expect(last(emissions).size).toBe(0);
  });

  it("reads nothing without PAM access", async () => {
    organizations.next([{ canAccessPrivilegedAccess: false } as Organization]);

    const emissions = collect();
    await settle();

    expect(last(emissions).size).toBe(0);
    expect(leasesApi.listMyLeases).not.toHaveBeenCalled();
  });

  it("reads nothing with the PAM flag off", async () => {
    pamFlag.next(false);

    collect();
    await settle();

    expect(leasesApi.listMyLeases).not.toHaveBeenCalled();
  });

  it("resolves to no views when the lease read fails", async () => {
    leasesApi.listMyLeases.mockRejectedValue(new Error("boom"));

    const emissions = collect();
    await settle();

    expect(last(emissions).size).toBe(0);
    expect(apiService.getFullCipherDetails).not.toHaveBeenCalled();
  });

  it("never writes the full cipher to cipher state or the server", async () => {
    leasesApi.listMyLeases.mockResolvedValue([lease()]);
    apiService.getFullCipherDetails.mockResolvedValue(cipherResponse());

    collect();
    await settle();
    accessChanged.next();
    await settle();

    expect(cipherService.upsert).not.toHaveBeenCalled();
    expect(cipherService.replace).not.toHaveBeenCalled();
    expect(cipherService.updateWithServer).not.toHaveBeenCalled();
    expect(cipherService.createWithServer).not.toHaveBeenCalled();
    expect(cipherService.saveCollectionsWithServer).not.toHaveBeenCalled();
    expect(apiService.putCipher).not.toHaveBeenCalled();
    expect(apiService.postCipher).not.toHaveBeenCalled();
  });
});
