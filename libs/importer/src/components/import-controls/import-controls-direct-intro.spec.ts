import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormGroup } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { KeeperInlineAuthUi } from "./direct/keeper/keeper-inline-auth-ui";
import { LastPassInlineAuthUi } from "./direct/lastpass/lastpass-inline-auth-ui";
import { ImportControlsDirectComponent } from "./import-controls-direct.component";

describe("ImportControlsDirectComponent: intro", () => {
  let fixture: ComponentFixture<ImportControlsDirectComponent>;

  const text = () => fixture.nativeElement.textContent as string;
  const rows = () =>
    fixture.debugElement
      .queryAll(By.css("bit-icon-tile"))
      .map((tile) => tile.nativeElement.parentElement as HTMLElement);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportControlsDirectComponent],
      providers: [
        {
          provide: KeeperInlineAuthUi,
          useValue: {
            stage: signal({ kind: "idle" }),
            screen: signal({ kind: "idle" }),
            subtitleKey: signal(null),
          },
        },
        {
          provide: LastPassInlineAuthUi,
          useValue: {
            stage: signal({ kind: "idle" }),
            subtitleKey: signal(null),
          },
        },
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportControlsDirectComponent);
    fixture.componentRef.setInput("form", new FormGroup({}));
    fixture.componentRef.setInput("step", "intro");
    fixture.componentRef.setInput("importType", "keeper");
    fixture.componentRef.setInput("isLastPass", false);
    fixture.componentRef.setInput("vendorName", "Keeper");
    fixture.detectChanges();
  });

  it("shows each value prop with an icon tile, not a bare icon", () => {
    expect(rows()).toHaveLength(3);
    for (const row of rows()) {
      expect(row.children[0].tagName.toLowerCase()).toBe("bit-icon-tile");
    }
    const icons = fixture.debugElement
      .queryAll(By.css("bit-icon-tile"))
      .map((tile) => tile.componentInstance.icon());
    expect(icons).toEqual(["bwi-lock", "bwi-eye", "bwi-download"]);
  });

  it("uses the base tile size", () => {
    for (const tile of fixture.debugElement.queryAll(By.css("bit-icon-tile"))) {
      expect(tile.componentInstance.size()).toBe("base");
    }
  });

  it("centers the tile on a 44px row, with 16px between the rows", () => {
    for (const row of rows()) {
      expect(row.classList).toContain("tw-items-center");
      expect(row.classList).toContain("tw-min-h-11");
      expect(row.classList).toContain("tw-gap-4");
    }
    const column = rows()[0].parentElement as HTMLElement;
    expect(column.classList).toContain("tw-flex-col");
    expect(column.classList).toContain("tw-gap-4");
  });

  // Web and the extension load Tailwind's preflight, which gives every heading and paragraph a
  // bottom margin that `noMargin` doesn't remove. Only an explicit class keeps them equal to desktop.
  it("zeroes the margins under a value prop's heading and text explicitly", () => {
    for (const row of rows()) {
      expect((row.querySelector("h3") as HTMLElement).classList).toContain("tw-mb-0");
      expect((row.querySelector("p") as HTMLElement).classList).toContain("tw-mb-0");
    }
  });

  it("keeps 16px between the subtitle and the first value prop explicitly", () => {
    const subtitle = fixture.nativeElement.querySelector("h2 + p") as HTMLElement;
    expect(subtitle.classList).toContain("tw-mb-4");
  });

  it("uses the product-approved wording for the first two value props", () => {
    expect(text()).toContain("importDataSecureByDesignTitleV2");
    expect(text()).toContain("importDataSecureByDesignBodyV2");
    expect(text()).toContain("importDataLoginInfoTitleV2");
    expect(text()).toContain("importDataLoginInfoBodyV2");
    expect(text()).not.toContain("importDataSecureByDesignTitle ");
    expect(text()).not.toContain("importDataLoginInfoTitle ");
  });

  it("words the third value prop as the automatic transfer", () => {
    expect(text()).toContain("importDataAutomaticTransferTitle");
    expect(text()).toContain("importDataAutomaticTransferBody");
    expect(text()).not.toContain("importDataEverythingTransfers");
  });
});
