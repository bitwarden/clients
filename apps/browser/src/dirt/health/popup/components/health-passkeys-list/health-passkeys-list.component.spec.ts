import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CompactModeService, DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { PasskeyGroup, PasskeyListRow } from "../../services/passkey-list";
import { HEALTH_LIST_ROW_ATTRIBUTE } from "../../shared/health-list";

import { HealthPasskeysListComponent } from "./health-passkeys-list.component";

/** The real vault icon needs domain settings, config and environment services. */
@Component({
  selector: "app-vault-icon",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// eslint-disable-next-line @angular-eslint/component-class-suffix
class MockAppVaultIcon {
  readonly cipher = input<CipherView | undefined>(undefined);
}

function row(
  name: string,
  init: Partial<Pick<PasskeyListRow, "group" | "secondary" | "setUpUrl" | "folderId">> = {},
): PasskeyListRow {
  const secondary = "secondary" in init ? init.secondary : `${name.toLowerCase()}@example.com`;
  return {
    id: name,
    cipher: new CipherView(),
    group: init.group ?? PasskeyGroup.Login,
    name,
    secondary,
    setUpUrl: "setUpUrl" in init ? init.setUpUrl : `https://${name.toLowerCase()}.example/pk`,
    folderId: init.folderId ?? null,
    searchText: `${name} ${secondary ?? ""}`.toLowerCase(),
  };
}

describe("HealthPasskeysListComponent", () => {
  let fixture: ComponentFixture<HealthPasskeysListComponent>;

  async function render(rows: PasskeyListRow[], init: { filtersToRestore?: object } = {}) {
    fixture = TestBed.createComponent(HealthPasskeysListComponent);
    fixture.componentRef.setInput("rows", rows);
    if (init.filtersToRestore) {
      fixture.componentRef.setInput("filtersToRestore", init.filtersToRestore);
    }
    await settle();
  }

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function rowButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll(`[${HEALTH_LIST_ROW_ATTRIBUTE}]`));
  }

  function rowIds(): (string | null)[] {
    return rowButtons().map((b) => b.getAttribute(HEALTH_LIST_ROW_ATTRIBUTE));
  }

  function setUpButton(id: string): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(`#health-passkeys-list_button_set-up-${id}`);
  }

  function text(): string {
    return fixture.nativeElement.textContent;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthPasskeysListComponent, NoopAnimationsModule, RouterTestingModule],
      providers: [
        {
          provide: I18nService,
          useValue: {
            collator: new Intl.Collator("en", { sensitivity: "base" }),
            translationLocale: "en",
            t: (key: string, ...args: unknown[]) =>
              [key, ...args.filter((arg) => arg != null)].join(" "),
          },
        },
        { provide: CompactModeService, useValue: { enabled$: new BehaviorSubject(false) } },
        { provide: LiveAnnouncer, useValue: { announce: jest.fn() } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
      ],
    })
      .overrideComponent(HealthPasskeysListComponent, {
        remove: { imports: [AppVaultIconComponent] },
        add: { imports: [MockAppVaultIcon] },
      })
      .compileComponents();
  });

  // jsdom gives the virtual viewport little height, so each case keeps to the rows it renders.
  it("puts the login group before the two-step group, whatever the names", async () => {
    await render([row("Apple", { group: PasskeyGroup.TwoStep }), row("Zoom")]);

    expect(rowIds()[0]).toBe("Zoom");
    expect(text()).toContain("passkeyLoginGroupDesc");
    expect(text()).toContain("passkeyTwoStepGroupDesc");
    expect(text().indexOf("passkeyLoginGroup")).toBeLessThan(text().indexOf("passkeyTwoStepGroup"));
  });

  it("sorts a group by name A to Z, ignoring case", async () => {
    await render([row("dropbox"), row("Amazon")]);

    expect(rowIds()).toEqual(["Amazon", "dropbox"]);
  });

  it("hides a group with no rows", async () => {
    await render([row("Amazon")]);

    expect(text()).toContain("passkeyLoginGroup");
    expect(text()).not.toContain("passkeyTwoStepGroup");
  });

  it("shows the name and second line, with no support badges", async () => {
    await render([row("Amazon")]);

    expect(text()).toContain("Amazon");
    expect(text()).toContain("amazon@example.com");
    expect(fixture.nativeElement.querySelector("[bitBadge]")).toBeNull();
  });

  it("falls back to 'No username' when a row has no second line", async () => {
    await render([row("Amazon", { secondary: undefined })]);

    expect(text()).toContain("noUsername");
    expect(rowButtons()[0].getAttribute("aria-label")).toBe(
      "viewItemTitleWithField Amazon noUsername",
    );
  });

  it("names the row button for screen readers with the name and second line", async () => {
    await render([row("Amazon")]);

    expect(rowButtons()[0].getAttribute("aria-label")).toBe(
      "viewItemTitleWithField Amazon amazon@example.com",
    );
  });

  it("emits open when a row is pressed", async () => {
    await render([row("Amazon")]);
    const opened = jest.fn();
    fixture.componentInstance.open.subscribe(opened);

    rowButtons()[0].click();

    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ id: "Amazon" }));
  });

  describe("Set up", () => {
    it("is a borderless text link with no icon, labelled for the item and the new tab", async () => {
      await render([row("Amazon")]);

      const button = setUpButton("Amazon")!;
      expect(button.hasAttribute("bitLink")).toBe(true);
      expect(button.textContent?.trim()).toBe("setUpPasskey");
      expect(button.querySelector("bit-icon, i")).toBeNull();
      expect(button.getAttribute("aria-label")).toBe("setUpPasskeyFor Amazon");
    });

    it("emits setUp, not open, when pressed", async () => {
      await render([row("Amazon")]);
      const opened = jest.fn();
      const setUp = jest.fn();
      fixture.componentInstance.open.subscribe(opened);
      fixture.componentInstance.setUp.subscribe(setUp);

      setUpButton("Amazon")!.click();

      expect(setUp).toHaveBeenCalledWith(expect.objectContaining({ id: "Amazon" }));
      expect(opened).not.toHaveBeenCalled();
    });

    it("is left out when there is nowhere to go", async () => {
      await render([row("Amazon", { setUpUrl: undefined })]);

      expect(setUpButton("Amazon")).toBeNull();
      expect(rowButtons()).toHaveLength(1);
    });
  });

  it("narrows to a restored search, and offers to clear it when nothing matches", async () => {
    await render([row("Amazon"), row("Dropbox")], { filtersToRestore: { search: "drop" } });
    expect(rowIds()).toEqual(["Dropbox"]);

    fixture.componentRef.setInput("rows", [row("Amazon")]);
    await settle();

    expect(text()).toContain("noItemsMatchSearch");
    expect(
      fixture.nativeElement.querySelector("#health-passkeys-list_button_clear-search"),
    ).not.toBeNull();
  });

  it("shows the Folder chip only when there are folders", async () => {
    await render([row("Amazon")]);
    expect(fixture.nativeElement.querySelector("bit-filter-menu")).toBeNull();

    fixture.componentRef.setInput("folderOptions", [{ value: "work", label: "Work" }]);
    await settle();

    expect(fixture.nativeElement.querySelector("bit-filter-menu")).not.toBeNull();
  });

  it("has no sort control", async () => {
    await render([row("Amazon")]);

    expect(fixture.nativeElement.querySelector("[bitMenuTriggerFor], bit-menu")).toBeNull();
  });
});
