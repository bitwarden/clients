import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ChipGroupComponent } from "@bitwarden/components";
import type { CollectionId } from "@bitwarden/sdk-internal";

import { AccessRuleCollectionBadgesComponent } from "./access-rule-collection-badges.component";

// JSDOM has no ResizeObserver, which the chip group uses to pack chips into the column.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

const collection = (id: string, name: string) => ({ id, name }) as CollectionAdminView;
const ids = (...values: string[]) => values as unknown as CollectionId[];

describe("AccessRuleCollectionBadgesComponent", () => {
  let fixture: ComponentFixture<AccessRuleCollectionBadgesComponent>;

  async function render(collectionIds: CollectionId[]) {
    await TestBed.configureTestingModule({
      imports: [AccessRuleCollectionBadgesComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string) => key, translate: (key: string) => key },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AccessRuleCollectionBadgesComponent);
    fixture.componentRef.setInput("collections", [
      collection("c-1", "Finance"),
      collection("c-2", "Engineering"),
    ]);
    fixture.componentRef.setInput("collectionIds", collectionIds);
    fixture.detectChanges();
  }

  const group = () => fixture.debugElement.query(By.directive(ChipGroupComponent));

  it("shows the muted placeholder and no chip group when there are no folders", async () => {
    await render(ids());

    expect(group()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("pamAccessRuleCollectionsNone");
  });

  it("gives a single folder one subtle chip", async () => {
    await render(ids("c-1"));

    const chips = (group().componentInstance as ChipGroupComponent).chips();
    expect(chips).toEqual([
      { id: "c-1", label: "Finance", variant: "subtle", startIcon: "bwi-shared-folder" },
    ]);
  });

  it("hands every folder to the chip group sorted by name, for its +N overflow", async () => {
    await render(ids("c-1", "c-2", "c-gone"));

    const chipGroup = group().componentInstance as ChipGroupComponent;
    expect(chipGroup.chips().map((c) => c.label)).toEqual(["c-gone", "Engineering", "Finance"]);
    expect(chipGroup.accessibleName()).toBe("pamAccessRuleAppliesTo");
  });
});
