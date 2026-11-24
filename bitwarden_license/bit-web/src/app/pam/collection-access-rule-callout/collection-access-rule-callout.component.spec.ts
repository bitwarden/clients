import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccessRuleSdkService } from "@bitwarden/bit-pam";
import type { AccessRuleView } from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { DialogRef } from "@bitwarden/components";

import { GovernedCollectionsService } from "../services/governed-collections.service";

import { CollectionAccessRuleCalloutComponent } from "./collection-access-rule-callout.component";

const ORG_ID = "org-1" as OrganizationId;
const COLLECTION_ID = "col-1" as CollectionId;

type CalloutCollection = {
  id: CollectionId;
  organizationId: OrganizationId;
  hasEnabledAccessRule?: boolean;
};

const GATED_COLLECTION: CalloutCollection = {
  id: COLLECTION_ID,
  organizationId: ORG_ID,
  hasEnabledAccessRule: true,
};

function rule(overrides: Record<string, unknown> = {}): AccessRuleView {
  return {
    id: "rule-1",
    name: "Production access",
    enabled: true,
    conditions: [],
    singleActiveLease: false,
    collections: [COLLECTION_ID],
    ...overrides,
  } as unknown as AccessRuleView;
}

describe("CollectionAccessRuleCalloutComponent", () => {
  let fixture: ComponentFixture<CollectionAccessRuleCalloutComponent>;
  let accessRuleSdkService: MockProxy<AccessRuleSdkService>;
  let logService: MockProxy<LogService>;
  let dialogRef: { close: jest.Mock };
  let enabled$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<{ id: string; canManageAccessRules: boolean }[]>;

  /**
   * Takes a rest parameter rather than a defaulted one, since a default would replace the explicit
   * `undefined` a test passes.
   */
  async function create(...args: [] | [CalloutCollection | undefined]): Promise<void> {
    fixture = TestBed.createComponent(CollectionAccessRuleCalloutComponent);
    fixture.componentRef.setInput("collection", args.length > 0 ? args[0] : GATED_COLLECTION);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function callout(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="collection-access-rule-callout"]');
  }

  function expectGenericCallout(): void {
    expect(callout()?.textContent).toContain("pamSharedFolderRequiresRequest");
    expect(fixture.nativeElement.querySelector("a")).toBeNull();
  }

  beforeEach(() => {
    accessRuleSdkService = mock<AccessRuleSdkService>();
    logService = mock<LogService>();
    dialogRef = { close: jest.fn() };
    enabled$ = new BehaviorSubject<boolean>(true);
    organizations$ = new BehaviorSubject<{ id: string; canManageAccessRules: boolean }[]>([
      { id: ORG_ID, canManageAccessRules: true },
    ]);
    accessRuleSdkService.listAccessRules.mockResolvedValue([]);

    TestBed.configureTestingModule({
      imports: [CollectionAccessRuleCalloutComponent],
      providers: [
        // The link's target, so clicking it navigates rather than logging an unmatched-route error.
        provideRouter([{ path: "organizations/:organizationId/pam/access-rules", children: [] }]),
        {
          provide: GovernedCollectionsService,
          useFactory: () => new GovernedCollectionsService(accessRuleSdkService, logService),
        },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: LogService, useValue: logService },
        { provide: DialogRef, useValue: dialogRef },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  it("renders nothing and reads nothing for a collection without an enabled rule", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([rule()]);

    await create({ ...GATED_COLLECTION, hasEnabledAccessRule: false });

    expect(accessRuleSdkService.listAccessRules).not.toHaveBeenCalled();
    expect(callout()).toBeNull();
  });

  it("names the governing rule", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([rule()]);

    await create();

    expect(callout()).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain("Production access");
    expect(fixture.nativeElement.textContent).not.toContain("pamSharedFolderRequiresRequest");
  });

  it("renders nothing while a manager's rule read is in flight, rather than the generic sentence", async () => {
    accessRuleSdkService.listAccessRules.mockReturnValue(new Promise(() => {}));

    await create();

    expect(callout()).toBeNull();
  });

  it("summarises what the rule enforces", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([
      rule({ conditions: [{ kind: "human_approval" }], singleActiveLease: true }),
    ]);

    await create();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("pamAccessRuleConditionRequiresApproval");
    expect(text).toContain("pamAccessRuleSingleActiveUser");
  });

  it("names every governing rule, not just the first", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([
      rule({ id: "rule-1", name: "First rule" }),
      rule({ id: "rule-2", name: "Second rule" }),
    ]);

    await create();

    expect(fixture.nativeElement.textContent).toContain("First rule");
    expect(fixture.nativeElement.textContent).toContain("Second rule");
  });

  it("falls back to the generic sentence when the rules read covers a different collection", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([
      rule({ name: "Elsewhere", collections: ["col-9"] }),
    ]);

    await create();

    expectGenericCallout();
    expect(fixture.nativeElement.textContent).not.toContain("Elsewhere");
  });

  it("falls back to the generic sentence when the only matching rule is disabled", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([rule({ enabled: false })]);

    await create();

    expectGenericCallout();
  });

  it("shows a user who can't manage access rules the generic sentence, without reading rules", async () => {
    organizations$.next([{ id: ORG_ID, canManageAccessRules: false }]);
    accessRuleSdkService.listAccessRules.mockResolvedValue([rule()]);

    await create();

    expect(accessRuleSdkService.listAccessRules).not.toHaveBeenCalled();
    expectGenericCallout();
  });

  it("shows the generic sentence for an organization the user isn't a member of", async () => {
    organizations$.next([]);

    await create();

    expect(accessRuleSdkService.listAccessRules).not.toHaveBeenCalled();
    expectGenericCallout();
  });

  it("reads nothing while the PAM feature flag is off", async () => {
    enabled$.next(false);

    await create();

    expect(accessRuleSdkService.listAccessRules).not.toHaveBeenCalled();
    expect(callout()).toBeNull();
  });

  it("renders nothing before the dialog has loaded the collection", async () => {
    await create(undefined);

    expect(accessRuleSdkService.listAccessRules).not.toHaveBeenCalled();
    expect(callout()).toBeNull();
  });

  it("falls back to the generic sentence and logs when the rule read fails", async () => {
    accessRuleSdkService.listAccessRules.mockRejectedValue(new Error("boom"));

    await create();

    expectGenericCallout();
    expect(logService.error).toHaveBeenCalled();
  });

  it("closes the host dialog when following the link to the rule", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([rule()]);
    await create();

    (fixture.nativeElement.querySelector("a") as HTMLElement).click();

    expect(dialogRef.close).toHaveBeenCalled();
  });

  it("links to the rule's own page, deep-linked by id", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([rule()]);

    await create();

    const href = (fixture.nativeElement.querySelector("a") as HTMLAnchorElement).getAttribute(
      "href",
    );
    expect(href).toBe("/organizations/org-1/pam/access-rules/rule-1");
  });
});
