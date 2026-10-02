import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { GroupView } from "../../core";

import { GroupNameBadgeComponent } from "./group-name-badge.component";

describe("GroupNameBadgeComponent", () => {
  let fixture: ComponentFixture<GroupNameBadgeComponent>;

  const group = (id: string, name: string) => new GroupView({ id, organizationId: "org-id", name });

  const selection = (id: string) => ({ id }) as SelectionReadOnlyRequest;

  async function setup(selectedGroups: SelectionReadOnlyRequest[], allGroups: GroupView[]) {
    const i18nService = mock<I18nService>();
    i18nService.collator = new Intl.Collator("en");
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [GroupNameBadgeComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupNameBadgeComponent);
    fixture.componentRef.setInput("selectedGroups", selectedGroups);
    fixture.componentRef.setInput("allGroups", allGroups);
    fixture.detectChanges();
  }

  const renderedBadges = () =>
    Array.from(fixture.nativeElement.querySelectorAll("span[bitBadge]") as NodeListOf<HTMLElement>)
      .map((badge) => badge.textContent?.trim())
      .filter((text): text is string => !!text);

  it("renders a badge for each selected group", async () => {
    await setup(
      [selection("group-1"), selection("group-2")],
      [group("group-1", "Engineering"), group("group-2", "Support"), group("group-3", "Unused")],
    );

    expect(fixture.nativeElement.querySelector("bit-badge-list")).not.toBeNull();
    expect(renderedBadges()).toEqual(["Engineering", "Support"]);
  });

  it("sorts the rendered group names", async () => {
    await setup(
      [selection("group-1"), selection("group-2"), selection("group-3")],
      [
        group("group-1", "Support"),
        group("group-2", "Accounting"),
        group("group-3", "Engineering"),
      ],
    );

    expect(renderedBadges()).toEqual(["Accounting", "Engineering", "Support"]);
  });

  it("ignores selected groups that are not in the full group list", async () => {
    await setup([selection("group-1"), selection("missing")], [group("group-1", "Engineering")]);

    expect(renderedBadges()).toEqual(["Engineering"]);
  });

  it("renders nothing when no groups are selected", async () => {
    await setup([], [group("group-1", "Engineering")]);

    expect(renderedBadges()).toEqual([]);
  });
});
