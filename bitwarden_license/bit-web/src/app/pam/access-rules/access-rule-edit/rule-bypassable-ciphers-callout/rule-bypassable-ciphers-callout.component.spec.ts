import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { AccessRuleId, AccessRuleSdkService } from "../../..";

import { RuleBypassableCiphersCalloutComponent } from "./rule-bypassable-ciphers-callout.component";

const ORG_ID = "org-1" as OrganizationId;
const RULE_ID = "rule-1" as unknown as AccessRuleId;

const ENG = "col-eng" as CollectionId;
const CONTRACTORS = "col-contractors" as CollectionId;

describe("RuleBypassableCiphersCalloutComponent", () => {
  let fixture: ComponentFixture<RuleBypassableCiphersCalloutComponent>;
  let accessRuleSdkService: MockProxy<AccessRuleSdkService>;
  let collectionAdminService: { collectionAdminViews$: jest.Mock };

  /**
   * Inputs are passed in an object rather than as positional parameters with defaults: a default
   * parameter fires for an explicit `undefined`, which is exactly the unsaved-rule case below.
   */
  async function create(
    inputs: { organizationId?: OrganizationId; accessRuleId?: AccessRuleId } = {},
  ): Promise<void> {
    const { organizationId = ORG_ID, accessRuleId = RULE_ID } = inputs;
    fixture = TestBed.createComponent(RuleBypassableCiphersCalloutComponent);
    fixture.componentRef.setInput(
      "organizationId",
      "organizationId" in inputs ? inputs.organizationId : organizationId,
    );
    fixture.componentRef.setInput(
      "accessRuleId",
      "accessRuleId" in inputs ? inputs.accessRuleId : accessRuleId,
    );
    fixture.detectChanges();
    // Twice: the read is kicked off from `afterNextRender`, and resolving it chains the server read
    // and then the collection-name read. One flush lands mid-chain, before the callout renders.
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function callout(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="rule-bypassable-ciphers-callout"]');
  }

  function gapLinks(): Array<{ text: string; href: string | null }> {
    return Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid^="rule-bypassable-gap-"] a',
      ) as NodeListOf<HTMLAnchorElement>,
    ).map((a) => ({ text: a.textContent!.trim(), href: a.getAttribute("href") }));
  }

  beforeEach(() => {
    accessRuleSdkService = mock<AccessRuleSdkService>();
    accessRuleSdkService.listBypassGaps.mockResolvedValue([]);
    collectionAdminService = {
      collectionAdminViews$: jest.fn().mockReturnValue(
        of([
          { id: ENG, name: "Engineering" },
          { id: CONTRACTORS, name: "Contractors" },
        ]),
      ),
    };

    TestBed.configureTestingModule({
      imports: [RuleBypassableCiphersCalloutComponent],
      providers: [
        // The remediation links' target, so routerLink resolves instead of erroring.
        provideRouter([{ path: "organizations/:organizationId/vault", children: [] }]),
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
        { provide: AccessRuleSdkService, useValue: accessRuleSdkService },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: CollectionAdminService, useValue: collectionAdminService },
      ],
    });
  });

  it("renders nothing when the rule gates everything it governs", async () => {
    await create();

    expect(callout()).toBeNull();
  });

  it("explains the bypass and names the collection letting items through", async () => {
    accessRuleSdkService.listBypassGaps.mockResolvedValue([ENG]);

    await create();

    expect(callout()).not.toBeNull();
    expect(callout()!.textContent).toContain("pamRuleBypassableCiphersBody");
    const links = gapLinks();
    expect(links).toHaveLength(1);
    expect(links[0].text).toBe("Engineering");
    // Filters the org vault to that collection — an exact id link, not a name search.
    expect(links[0].href).toContain(`collectionId=${ENG}`);
  });

  /**
   * Closing only one way in fixes nothing, so every gap is listed — in a stable order, since the
   * server answers from an unordered read and reshuffling links between refreshes is jarring.
   */
  it("lists every gap, sorted by name", async () => {
    accessRuleSdkService.listBypassGaps.mockResolvedValue([ENG, CONTRACTORS]);

    await create();

    expect(gapLinks().map((l) => l.text)).toEqual(["Contractors", "Engineering"]);
  });

  /**
   * Separated by commas, not whitespace: adjacent links otherwise render as one run-on phrase
   * ("Marketing Security") and the reader cannot tell where one collection ends.
   */
  it("separates several gaps so they do not run together", async () => {
    accessRuleSdkService.listBypassGaps.mockResolvedValue([ENG, CONTRACTORS]);

    await create();

    const rendered = fixture.nativeElement
      .querySelector('[data-testid="rule-bypassable-ciphers-remediation"]')
      .textContent.replace(/\s+/g, " ")
      .trim();
    expect(rendered).toContain("Contractors, Engineering");
  });

  /** An entry with no name is the least useful thing to lead with, so it sorts last. */
  it("puts unnameable gaps after named ones", async () => {
    accessRuleSdkService.listBypassGaps.mockResolvedValue(["col-unknown" as CollectionId, ENG]);

    await create();

    expect(gapLinks().map((l) => l.text)).toEqual([
      "Engineering",
      "pamRuleBypassableCiphersUnnamedCollection",
    ]);
  });

  /**
   * The whole reason this surface reports collections rather than ciphers: the admin collection read
   * returns every collection to an Admin/Owner, so a gap names itself even for an admin assigned to
   * none of them — where a cipher name would have resolved to nothing.
   */
  it("names a gap the admin is not assigned to", async () => {
    accessRuleSdkService.listBypassGaps.mockResolvedValue([ENG]);

    await create();

    expect(gapLinks()[0].text).toBe("Engineering");
    expect(collectionAdminService.collectionAdminViews$).toHaveBeenCalledWith(ORG_ID, "user-1");
  });

  it("still links a collection whose name cannot be resolved", async () => {
    const unknown = "col-unknown" as CollectionId;
    accessRuleSdkService.listBypassGaps.mockResolvedValue([unknown]);

    await create();

    const links = gapLinks();
    expect(links).toHaveLength(1);
    expect(links[0].text).toBe("pamRuleBypassableCiphersUnnamedCollection");
    expect(links[0].href).toContain(`collectionId=${unknown}`);
  });

  /** Names are a nicety; a failed collection read must still leave the warning and its links. */
  it("still warns when the collection-name read fails", async () => {
    accessRuleSdkService.listBypassGaps.mockResolvedValue([ENG]);
    collectionAdminService.collectionAdminViews$.mockReturnValue(
      throwError(() => new Error("boom")),
    );

    await create();

    expect(callout()).not.toBeNull();
    expect(gapLinks()[0].text).toBe("pamRuleBypassableCiphersUnnamedCollection");
  });

  it("stays quiet on the create page, where there is no saved rule to assess", async () => {
    await create({ accessRuleId: undefined });

    expect(callout()).toBeNull();
    expect(accessRuleSdkService.listBypassGaps).not.toHaveBeenCalled();
  });

  /**
   * Informational, never a gate: this warns about someone else's misconfiguration, so a failed read
   * must not break the form it sits above.
   */
  it("hides itself when the read fails", async () => {
    accessRuleSdkService.listBypassGaps.mockRejectedValue(new Error("boom"));

    await create();

    expect(callout()).toBeNull();
  });

  it("asks the server about the rule on the route", async () => {
    await create();

    expect(accessRuleSdkService.listBypassGaps).toHaveBeenCalledWith(ORG_ID, RULE_ID);
  });
});
