import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SharedFolderFieldFolder } from "@bitwarden/vault";

import { ControlledAccessSharedFolderHintComponent } from "./controlled-access-shared-folder-hint.component";

const MESSAGES: Record<string, string> = {
  pamSharedFolderFieldHintSingular:
    "You'll need an approved access request to use this item. $NAMES$ has controlled access.",
  pamSharedFolderFieldHintPlural:
    "You'll need an approved access request to use this item. $NAMES$ have controlled access.",
};

describe("ControlledAccessSharedFolderHintComponent", () => {
  let fixture: ComponentFixture<ControlledAccessSharedFolderHintComponent>;
  let messages: Record<string, string>;

  function folder(name: string, hasEnabledAccessRule: boolean): SharedFolderFieldFolder {
    return { collection: { name, hasEnabledAccessRule } as CollectionView, name };
  }

  function render(folders: SharedFolderFieldFolder[]): void {
    fixture.componentRef.setInput("folders", folders);
    fixture.detectChanges();
  }

  function hint(): HTMLElement | null {
    return fixture.nativeElement.querySelector("bit-hint");
  }

  function names(): string[] {
    return Array.from(hint()?.querySelectorAll("em") ?? [], (em) => em.textContent!.trim());
  }

  beforeEach(() => {
    messages = { ...MESSAGES };
    const i18nService = mock<I18nService>();
    i18nService.translationLocale = "en";
    i18nService.t.mockImplementation((key: string, names?: string | number) =>
      messages[key].replace("$NAMES$", String(names ?? "")),
    );

    TestBed.configureTestingModule({
      imports: [ControlledAccessSharedFolderHintComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    });
    fixture = TestBed.createComponent(ControlledAccessSharedFolderHintComponent);
  });

  it("is a polite live region even while empty, so the hint is announced when it appears", () => {
    render([]);

    expect(fixture.nativeElement.getAttribute("aria-live")).toBe("polite");
    expect(hint()).toBeNull();
  });

  it("renders nothing while no selected folder is under controlled access", () => {
    render([folder("Plain", false)]);

    expect(hint()).toBeNull();
  });

  it("leads with what the user needs, then names one controlled folder, italicised, with 'has'", () => {
    render([folder("Plain", false), folder("Production", true)]);

    expect(hint()!.textContent!.replace(/\s+/g, " ").trim()).toBe(
      "You'll need an approved access request to use this item. Production has controlled access.",
    );
    expect(names()).toEqual(["Production"]);
  });

  it("joins two controlled folders with 'and' and uses 'have'", () => {
    render([folder("Production", true), folder("Databases", true)]);

    expect(hint()!.textContent!.replace(/\s+/g, " ").trim()).toBe(
      "You'll need an approved access request to use this item. Production and Databases have controlled access.",
    );
    expect(names()).toEqual(["Production", "Databases"]);
  });

  it("joins three or more as a list", () => {
    render([folder("A", true), folder("B", true), folder("C", true)]);

    expect(hint()!.textContent!.replace(/\s+/g, " ").trim()).toBe(
      "You'll need an approved access request to use this item. A, B, and C have controlled access.",
    );
    expect(names()).toEqual(["A", "B", "C"]);
  });

  it("appears and disappears as the selection changes", () => {
    render([folder("Production", true)]);
    expect(hint()).not.toBeNull();

    render([folder("Plain", false)]);
    expect(hint()).toBeNull();
  });

  it("names each folder by the display name the field shows, not its stored name", () => {
    render([
      {
        collection: { name: "stored", hasEnabledAccessRule: true } as CollectionView,
        name: "My items",
      },
    ]);

    expect(names()).toEqual(["My items"]);
  });

  it("falls back to the whole sentence when a translation drops the placeholder", () => {
    messages.pamSharedFolderFieldHintSingular = "Controlled folder selected.";
    render([folder("Production", true)]);

    expect(hint()!.textContent!.trim()).toBe("Controlled folder selected.");
    expect(names()).toEqual([]);
  });
});
