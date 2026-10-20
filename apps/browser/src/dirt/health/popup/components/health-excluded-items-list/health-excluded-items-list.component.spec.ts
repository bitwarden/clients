import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { HealthExcludedItemsListComponent } from "./health-excluded-items-list.component";

@Component({
  selector: "app-vault-icon",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// FIXME(https://bitwarden.atlassian.net/browse/PM-28231): Use Component suffix
// eslint-disable-next-line @angular-eslint/component-class-suffix
class MockAppVaultIcon {
  readonly cipher = input<CipherView | undefined>(undefined);
}

describe("HealthExcludedItemsListComponent", () => {
  let fixture: ComponentFixture<HealthExcludedItemsListComponent>;

  function buildLogin(args: { id: string; name?: string; username?: string }): CipherView {
    const cipher = new CipherView();
    cipher.id = args.id;
    cipher.name = args.name ?? args.id;
    cipher.type = CipherType.Login;
    cipher.login.username = args.username ?? `${args.id}@example.com`;
    return cipher;
  }

  async function initComponent(items: CipherView[]) {
    fixture = TestBed.createComponent(HealthExcludedItemsListComponent);
    fixture.componentRef.setInput("items", items);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  function section(): HTMLElement | null {
    return fixture.nativeElement.querySelector("bit-section");
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("bit-item"));
  }

  function toggleButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector("button[bitIconButton]");
  }

  function restoreButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("bit-item button[bitButton]"));
  }

  async function toggle() {
    toggleButton().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthExcludedItemsListComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    })
      .overrideComponent(HealthExcludedItemsListComponent, {
        remove: { imports: [AppVaultIconComponent] },
        add: { imports: [MockAppVaultIcon] },
      })
      .compileComponents();
  });

  it("renders nothing when there are no excluded items", async () => {
    await initComponent([]);

    expect(section()).toBeNull();
    expect(text().trim()).toBe("");
  });

  it("renders the section header with the excluded item count", async () => {
    await initComponent([buildLogin({ id: "a" }), buildLogin({ id: "b" })]);

    expect(section()).not.toBeNull();
    expect(text()).toContain("excludedFromList");
    expect(fixture.nativeElement.querySelector("bit-section-header").textContent).toContain("2");
  });

  it("starts collapsed, hiding the individual items", async () => {
    await initComponent([buildLogin({ id: "a" })]);

    expect(fixture.componentInstance.isCollapsed()).toBe(true);
    expect(rows()).toHaveLength(0);
  });

  it("labels the collapse toggle", async () => {
    await initComponent([buildLogin({ id: "a" })]);

    expect(toggleButton()).not.toBeNull();
    expect(toggleButton().getAttribute("aria-label")).toBe("toggleCollapse");
  });

  it("points the toggle down while collapsed and up while expanded", async () => {
    await initComponent([buildLogin({ id: "a" })]);

    expect(toggleButton().getAttribute("bitIconButton")).toBe("bwi-angle-down");

    await toggle();

    expect(toggleButton().getAttribute("bitIconButton")).toBe("bwi-angle-up");
  });

  it("expands to show each item when the toggle is clicked", async () => {
    await initComponent([
      buildLogin({ id: "a", name: "Alpha", username: "alpha@example.com" }),
      buildLogin({ id: "b", name: "Bravo", username: "bravo@example.com" }),
    ]);

    await toggle();

    expect(fixture.componentInstance.isCollapsed()).toBe(false);
    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain("Alpha");
    expect(rows()[0].textContent).toContain("alpha@example.com");
    expect(rows()[1].textContent).toContain("Bravo");
    expect(rows()[1].textContent).toContain("bravo@example.com");
  });

  it("collapses again when the toggle is clicked a second time", async () => {
    await initComponent([buildLogin({ id: "a" })]);

    await toggle();
    await toggle();

    expect(fixture.componentInstance.isCollapsed()).toBe(true);
    expect(rows()).toHaveLength(0);
  });

  it("passes each cipher to its vault icon", async () => {
    const items = [buildLogin({ id: "a" }), buildLogin({ id: "b" })];
    await initComponent(items);

    await toggle();

    const icons = fixture.debugElement
      .queryAll((n) => n.name === "app-vault-icon")
      .map((n) => n.componentInstance as MockAppVaultIcon);
    expect(icons.map((icon) => icon.cipher())).toEqual(items);
  });

  it("renders a localized restore button for each item", async () => {
    await initComponent([buildLogin({ id: "a" }), buildLogin({ id: "b" })]);

    await toggle();

    expect(restoreButtons()).toHaveLength(2);
    restoreButtons().forEach((button) => expect(button.textContent).toContain("restore"));
  });

  it("emits the cipher id of the item whose restore button was clicked", async () => {
    await initComponent([buildLogin({ id: "a" }), buildLogin({ id: "b" })]);
    const restored: string[] = [];
    fixture.componentInstance.onRestoreItem.subscribe((id) => restored.push(id));

    await toggle();
    restoreButtons()[1].click();

    expect(restored).toEqual(["b"]);
  });

  it("hides the section once the last excluded item is removed", async () => {
    await initComponent([buildLogin({ id: "a" })]);

    fixture.componentRef.setInput("items", []);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(section()).toBeNull();
  });
});
