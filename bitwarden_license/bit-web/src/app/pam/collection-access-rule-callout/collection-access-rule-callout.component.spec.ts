import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { DialogRef } from "@bitwarden/components";

import { AccessRuleSdkService } from "..";
import type { AccessRuleView } from "../abstractions/access-rule";

import { CollectionAccessRuleCalloutComponent } from "./collection-access-rule-callout.component";

const ORG_ID = "org-1" as OrganizationId;
const COLLECTION_ID = "col-1" as CollectionId;

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

  /**
   * Inputs are passed in an object rather than as positional parameters with defaults: a default
   * parameter fires for an explicit `undefined`, which is exactly the case these tests need to set.
   */
  async function create(
    inputs: { organizationId?: OrganizationId; collectionId?: CollectionId } = {},
  ): Promise<void> {
    const { organizationId = ORG_ID, collectionId = COLLECTION_ID } = inputs;
    fixture = TestBed.createComponent(CollectionAccessRuleCalloutComponent);
    fixture.componentRef.setInput(
      "organizationId",
      "organizationId" in inputs ? inputs.organizationId : organizationId,
    );
    fixture.componentRef.setInput(
      "collectionId",
      "collectionId" in inputs ? inputs.collectionId : collectionId,
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function callout(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="collection-access-rule-callout"]');
  }

  beforeEach(() => {
    accessRuleSdkService = mock<AccessRuleSdkService>();
    logService = mock<LogService>();
    dialogRef = { close: jest.fn() };
    enabled$ = new BehaviorSubject<boolean>(true);
    accessRuleSdkService.listAccessRules.mockResolvedValue([]);

    TestBed.configureTestingModule({
      imports: [CollectionAccessRuleCalloutComponent],
      providers: [
        // The link's target, so clicking it navigates rather than logging an unmatched-route error.
        provideRouter([{ path: "organizations/:organizationId/pam/access-rules", children: [] }]),
        { provide: AccessRuleSdkService, useValue: accessRuleSdkService },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: LogService, useValue: logService },
        { provide: DialogRef, useValue: dialogRef },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  it("renders nothing when no rule governs the collection", async () => {
    await create();

    expect(callout()).toBeNull();
  });

  it("names the governing rule", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([rule()]);

    await create();

    expect(callout()).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain("Production access");
  });

  it("summarises what the rule enforces", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([
      rule({ conditions: [{ kind: "human_approval" }], singleActiveLease: true }),
    ]);

    await create();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("pamAccessRuleConditionRequiresApproval");
    expect(text).toContain("pamAccessRuleSingleActiveLease");
  });

  it("names every governing rule, not just the first", async () => {
    // A collection can be governed by more than one; naming one would understate the gating.
    accessRuleSdkService.listAccessRules.mockResolvedValue([
      rule({ id: "rule-1", name: "First rule" }),
      rule({ id: "rule-2", name: "Second rule" }),
    ]);

    await create();

    expect(fixture.nativeElement.textContent).toContain("First rule");
    expect(fixture.nativeElement.textContent).toContain("Second rule");
  });

  it("ignores rules that cover a different collection", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([
      rule({ name: "Elsewhere", collections: ["col-9"] }),
    ]);

    await create();

    expect(callout()).toBeNull();
  });

  it("ignores a disabled rule", async () => {
    accessRuleSdkService.listAccessRules.mockResolvedValue([rule({ enabled: false })]);

    await create();

    expect(callout()).toBeNull();
  });

  it("reads nothing while the PAM feature flag is off", async () => {
    enabled$.next(false);

    await create();

    expect(accessRuleSdkService.listAccessRules).not.toHaveBeenCalled();
    expect(callout()).toBeNull();
  });

  it("reads nothing without a collection id — that is the create-mode dialog", async () => {
    await create({ organizationId: ORG_ID, collectionId: undefined });

    expect(accessRuleSdkService.listAccessRules).not.toHaveBeenCalled();
  });

  it("reads nothing without an organization id", async () => {
    await create({ organizationId: undefined, collectionId: COLLECTION_ID });

    expect(accessRuleSdkService.listAccessRules).not.toHaveBeenCalled();
  });

  it("hides itself and logs when the rule read fails, rather than blocking the dialog", async () => {
    // The callout is informational, not a gate.
    accessRuleSdkService.listAccessRules.mockRejectedValue(new Error("boom"));

    await create();

    expect(callout()).toBeNull();
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
    expect(href).toContain("/organizations/org-1/pam/access-rules");
    expect(href).toContain("accessRuleId=rule-1");
  });
});
