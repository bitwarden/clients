import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";

import { AccessCondition, AccessRuleResponse, PamApiService } from "@bitwarden/bit-pam";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { DialogRef, I18nMockService } from "@bitwarden/components";

import { CollectionAccessRuleCalloutComponent } from "./collection-access-rule-callout.component";

const ORG_ID = "org-1" as OrganizationId;
const COLLECTION_ID = "col-1" as CollectionId;

function rule(overrides: {
  id?: string;
  name?: string;
  enabled?: boolean;
  collections?: string[];
  conditions?: AccessCondition[];
}): AccessRuleResponse {
  return new AccessRuleResponse({
    Id: overrides.id ?? "rule-1",
    Name: overrides.name ?? "Rule 1",
    Enabled: overrides.enabled ?? true,
    Collections: overrides.collections ?? [COLLECTION_ID],
    Conditions: overrides.conditions ?? [],
    SingleActiveLease: false,
  });
}

describe("CollectionAccessRuleCalloutComponent", () => {
  let pamEnabled: boolean;
  let listAccessRules: jest.Mock;
  let logError: jest.Mock;
  let dialogClose: jest.Mock;

  beforeEach(async () => {
    pamEnabled = true;
    listAccessRules = jest.fn().mockResolvedValue({ data: [] });
    logError = jest.fn();
    dialogClose = jest.fn();

    await TestBed.configureTestingModule({
      imports: [CollectionAccessRuleCalloutComponent],
      providers: [
        provideRouter([]),
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(pamEnabled) } },
        { provide: PamApiService, useValue: { listAccessRules } },
        { provide: LogService, useValue: { error: logError } },
        { provide: DialogRef, useValue: { close: dialogClose } },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            pamCollectionAccessRuleCalloutTitle: "Access rule",
            pamCollectionAccessRuleCalloutBody: "Access to items here is controlled by",
            pamAccessRuleSummaryHumanApproval: "Approval",
            pamAccessRuleSummaryIpAllowlist: "IP restriction",
            pamAccessRuleSummarySingleActiveLease: "Single user access",
            pamAccessRuleSummaryNoConditions: "No conditions",
            close: "Close",
          }),
        },
      ],
    }).compileComponents();
  });

  const create = async (
    opts: { organizationId?: OrganizationId; collectionId?: CollectionId } = {},
  ): Promise<ComponentFixture<CollectionAccessRuleCalloutComponent>> => {
    const fixture = TestBed.createComponent(CollectionAccessRuleCalloutComponent);
    fixture.componentRef.setInput("organizationId", opts.organizationId ?? ORG_ID);
    fixture.componentRef.setInput(
      "collectionId",
      "collectionId" in opts ? opts.collectionId : COLLECTION_ID,
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const callout = (fixture: ComponentFixture<CollectionAccessRuleCalloutComponent>) =>
    fixture.nativeElement.querySelector("bit-callout");

  it("renders nothing and skips the fetch when the PAM feature flag is off", async () => {
    pamEnabled = false;
    listAccessRules.mockResolvedValue({ data: [rule({ name: "VPN access" })] });

    const fixture = await create();

    expect(callout(fixture)).toBeNull();
    expect(listAccessRules).not.toHaveBeenCalled();
  });

  it("renders nothing and skips the fetch in create mode (no collectionId)", async () => {
    listAccessRules.mockResolvedValue({ data: [rule({ name: "VPN access" })] });

    const fixture = await create({ collectionId: undefined });

    expect(callout(fixture)).toBeNull();
    expect(listAccessRules).not.toHaveBeenCalled();
  });

  it("renders nothing when no enabled rule targets the collection", async () => {
    listAccessRules.mockResolvedValue({
      data: [
        rule({ id: "a", name: "Disabled here", enabled: false, collections: [COLLECTION_ID] }),
        rule({ id: "b", name: "Enabled elsewhere", collections: ["other-col"] }),
      ],
    });

    const fixture = await create();

    expect(callout(fixture)).toBeNull();
  });

  it("renders a callout naming the enabled rule targeting the collection", async () => {
    listAccessRules.mockResolvedValue({
      data: [
        rule({
          id: "a",
          name: "VPN access",
          collections: [COLLECTION_ID],
          conditions: [{ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] }],
        }),
        rule({ id: "b", name: "Enabled elsewhere", collections: ["other-col"] }),
        rule({ id: "c", name: "Disabled here", enabled: false, collections: [COLLECTION_ID] }),
      ],
    });

    const fixture = await create();

    const text = fixture.nativeElement.textContent;
    expect(callout(fixture)).not.toBeNull();
    expect(text).toContain("VPN access");
    expect(text).toContain("IP restriction");
    expect(text).not.toContain("Enabled elsewhere");
    expect(text).not.toContain("Disabled here");
  });

  it("deep-links to the specific rule on the organization's access-rules page", async () => {
    listAccessRules.mockResolvedValue({ data: [rule({ id: "rule-42", name: "VPN access" })] });

    const fixture = await create();

    const link = fixture.debugElement.query(By.css("a[bitLink]"))
      .nativeElement as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(
      "/organizations/org-1/pam/access-rules?accessRuleId=rule-42",
    );
  });

  it("closes the dialog when the rule name link is clicked", async () => {
    listAccessRules.mockResolvedValue({ data: [rule({ name: "VPN access" })] });

    const fixture = await create();

    // Use a non-primary click so routerLink no-ops but the (click) handler still fires.
    const link = fixture.debugElement.query(By.css("a[bitLink]"));
    link.triggerEventHandler("click", new MouseEvent("click", { button: 1 }));

    expect(dialogClose).toHaveBeenCalled();
  });

  it("degrades to nothing and logs when the fetch fails", async () => {
    listAccessRules.mockRejectedValue(new Error("boom"));

    const fixture = await create();

    expect(callout(fixture)).toBeNull();
    expect(logError).toHaveBeenCalled();
  });
});
