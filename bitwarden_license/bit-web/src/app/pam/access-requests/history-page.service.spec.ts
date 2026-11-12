import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject, firstValueFrom } from "rxjs";

import {
  AccessEventService,
  AccessRequestHistoryPage,
  AccessRequestHistoryQuery,
  AccessRequestView,
  ApprovalSdkService,
} from "@bitwarden/bit-pam";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "./access-name-resolver.service";
import { HistoryPageService } from "./history-page.service";

function request(overrides: Record<string, unknown> = {}): AccessRequestView {
  return {
    id: "req-1",
    cipherId: "cipher-1",
    collectionId: "col-1",
    requesterId: "user-1",
    status: "denied",
    leaseNotBefore: "2026-08-17T09:00:00.000Z",
    leaseNotAfter: "2026-08-17T10:00:00.000Z",
    submittedAt: "2026-08-17T08:00:00.000Z",
    resolvedAt: "2026-08-17T08:30:00.000Z",
    decisions: [],
    requesterName: "Grace",
    ...overrides,
  } as unknown as AccessRequestView;
}

function page(overrides: Partial<AccessRequestHistoryPage> = {}): AccessRequestHistoryPage {
  return {
    requests: [request()],
    total: 1,
    requesters: [],
    collectionIds: [],
    ...overrides,
  } as AccessRequestHistoryPage;
}

function query(overrides: Partial<AccessRequestHistoryQuery> = {}): AccessRequestHistoryQuery {
  return {
    page: 0,
    pageSize: 10,
    statuses: [],
    collectionIds: [],
    requesterIds: [],
    ...overrides,
  } as AccessRequestHistoryQuery;
}

describe("HistoryPageService", () => {
  let service: HistoryPageService;
  let approvalApi: MockProxy<ApprovalSdkService>;
  let nameResolver: MockProxy<AccessNameResolverService>;
  let push$: Subject<void>;
  let inboxPush$: Subject<void>;

  beforeEach(() => {
    approvalApi = mock<ApprovalSdkService>();
    nameResolver = mock<AccessNameResolverService>();
    push$ = new Subject<void>();
    inboxPush$ = new Subject<void>();

    approvalApi.listHistory.mockResolvedValue(page());
    nameResolver.resolveNames.mockResolvedValue(emptyResolvedNames() as ResolvedNames);

    TestBed.configureTestingModule({
      providers: [
        HistoryPageService,
        { provide: ApprovalSdkService, useValue: approvalApi },
        { provide: AccessNameResolverService, useValue: nameResolver },
        {
          provide: AccessEventService,
          useValue: {
            accessChanged$: () => push$.asObservable(),
            approverInboxChanged$: () => inboxPush$.asObservable(),
          },
        },
      ],
    });
    service = TestBed.inject(HistoryPageService);
  });

  /** Lets the read the last emission started land. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  }

  it("reads nothing until the tab sets a query", async () => {
    push$.next();
    await settle();

    expect(approvalApi.listHistory).not.toHaveBeenCalled();
    expect(await firstValueFrom(service.loading$)).toBe(true);
    expect(await firstValueFrom(service.page$)).toBeNull();
  });

  it("reads the query's page and names its rows and filter options", async () => {
    const names = emptyResolvedNames() as ResolvedNames;
    names.cipherNameById.set("cipher-1", "Prod database");
    names.collectionNameById.set("col-1", "Ops");
    names.collectionNameById.set("col-2", "Billing");
    names.cipherById.set("cipher-1", { id: "cipher-1" } as CipherView);
    nameResolver.resolveNames.mockResolvedValue(names);
    approvalApi.listHistory.mockResolvedValue(
      page({
        total: 26,
        requesters: [
          { id: "user-2", name: undefined, email: "zed@example.com" },
          { id: "user-1", name: "Ada", email: "ada@example.com" },
        ],
        collectionIds: ["col-1", "col-2", "col-unknown"],
      } as unknown as Partial<AccessRequestHistoryPage>),
    );
    const q = query({ page: 2 });

    service.setQuery(q);
    await settle();

    expect(approvalApi.listHistory).toHaveBeenCalledWith(q);
    expect(nameResolver.resolveNames).toHaveBeenCalledWith([
      { cipherId: "cipher-1", collectionId: "col-1" },
    ]);
    const view = (await firstValueFrom(service.page$))!;
    expect(view.rows.map((row) => row.cipherName)).toEqual(["Prod database"]);
    expect(view.total).toBe(26);
    expect(view.requesterOptions).toEqual([
      { value: "user-1", label: "Ada" },
      { value: "user-2", label: "zed@example.com" },
    ]);
    // A collection outside the caller's vault has no name, so it is not offered.
    expect(view.collectionOptions).toEqual([
      { value: "col-2", label: "Billing" },
      { value: "col-1", label: "Ops" },
    ]);
    expect(view.cipherById.get("cipher-1")).toBeDefined();
    expect(await firstValueFrom(service.loading$)).toBe(false);
  });

  it("keeps the shared folder options when a filter leaves the page with no rows", async () => {
    const names = emptyResolvedNames() as ResolvedNames;
    names.collectionNameById.set("col-1", "Ops");
    nameResolver.resolveNames.mockResolvedValue(names);
    approvalApi.listHistory.mockResolvedValueOnce(page({ collectionIds: ["col-1"] } as never));
    service.setQuery(query());
    await settle();
    // With no rows, the resolver has nothing to name.
    nameResolver.resolveNames.mockResolvedValue(emptyResolvedNames() as ResolvedNames);
    approvalApi.listHistory.mockResolvedValueOnce(
      page({ requests: [], total: 0, collectionIds: ["col-1"] } as never),
    );

    service.setQuery(query({ requesterIds: ["user-9"] } as never));
    await settle();

    expect((await firstValueFrom(service.page$))!.collectionOptions).toEqual([
      { value: "col-1", label: "Ops" },
    ]);
  });

  it("does not read again for the same query", async () => {
    service.setQuery(query());
    await settle();
    service.setQuery(query());
    await settle();

    expect(approvalApi.listHistory).toHaveBeenCalledTimes(1);
  });

  it("re-reads the current page on either push without showing the loading state", async () => {
    service.setQuery(query({ page: 3 }));
    await settle();
    let resolveRead!: (value: AccessRequestHistoryPage) => void;
    approvalApi.listHistory.mockReturnValueOnce(
      new Promise<AccessRequestHistoryPage>((resolve) => (resolveRead = resolve)),
    );

    push$.next();
    await settle();

    expect(approvalApi.listHistory).toHaveBeenLastCalledWith(query({ page: 3 }));
    expect(await firstValueFrom(service.loading$)).toBe(false);
    resolveRead(page({ total: 2 }));
    await settle();
    expect((await firstValueFrom(service.page$))!.total).toBe(2);

    inboxPush$.next();
    await settle();
    expect(approvalApi.listHistory).toHaveBeenCalledTimes(3);
  });

  it("shows the loading state while a new query's page is read", async () => {
    service.setQuery(query());
    await settle();
    approvalApi.listHistory.mockReturnValueOnce(new Promise<AccessRequestHistoryPage>(() => {}));

    service.setQuery(query({ page: 1 }));
    await settle();

    expect(await firstValueFrom(service.loading$)).toBe(true);
  });

  it("records a failed read and keeps the page on screen", async () => {
    service.setQuery(query());
    await settle();
    approvalApi.listHistory.mockRejectedValueOnce(new Error("boom"));

    service.setQuery(query({ page: 1 }));
    await settle();

    expect(await firstValueFrom(service.loadError$)).toEqual(new Error("boom"));
    expect((await firstValueFrom(service.page$))!.total).toBe(1);
    expect(await firstValueFrom(service.loading$)).toBe(false);
  });
});
