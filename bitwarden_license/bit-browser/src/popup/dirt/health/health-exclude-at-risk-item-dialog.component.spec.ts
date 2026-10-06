import { DIALOG_DATA } from "@angular/cdk/dialog";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import { RiskCategory } from "@bitwarden/bit-common/dirt/vault-health/models";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef } from "@bitwarden/components";

import {
  HealthExcludeAtRiskItemDialogComponent,
  HealthExcludeAtRiskItemDialogData,
} from "./health-exclude-at-risk-item-dialog.component";

describe("HealthExcludeAtRiskItemDialogComponent", () => {
  let fixture: ComponentFixture<HealthExcludeAtRiskItemDialogComponent>;
  let dialogRef: MockProxy<DialogRef>;

  function buildHealthView(args: Partial<CipherHealthView> = {}): CipherHealthView {
    return new CipherHealthView({
      cipherId: "cipher-1",
      hasWeakPassword: false,
      hasReusedPassword: false,
      hasExposedPassword: false,
      exposedCount: 0,
      reuseCount: 0,
      ...args,
    });
  }

  async function initComponent(data: Partial<HealthExcludeAtRiskItemDialogData> = {}) {
    const dialogData: HealthExcludeAtRiskItemDialogData = {
      currentCategory: RiskCategory.Exposed,
      item: buildHealthView({ hasExposedPassword: true }),
      ...data,
    };

    dialogRef = mock<DialogRef>();
    // a bare mock returns a truthy stub here, which would disable every bitDialogClose button
    dialogRef.disableClose = false;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HealthExcludeAtRiskItemDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HealthExcludeAtRiskItemDialogComponent);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return host().textContent ?? "";
  }

  function button(label: string): HTMLButtonElement {
    return Array.from(host().querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      b.textContent?.includes(label),
    )!;
  }

  it("renders the title, description and actions", async () => {
    await initComponent();

    expect(text()).toContain("excludeFromList");
    expect(text()).toContain("excludeFromListDesc");
    expect(text()).toContain("excludeAnyway");
    expect(text()).toContain("cancel");
  });

  it("shows the danger icon instead of the default warning icon", async () => {
    await initComponent();

    expect(host().querySelector('bit-icon[name="bwi-error"]')).not.toBeNull();
  });

  it("shows the additional risks when the item has lower risks", async () => {
    await initComponent({
      item: buildHealthView({ hasExposedPassword: true, hasReusedPassword: true }),
    });

    expect(text()).toContain("passwordHasAdditionalRisks");
  });

  it("hides the additional risks when the item has no lower risks", async () => {
    await initComponent({
      currentCategory: RiskCategory.Reused,
      item: buildHealthView({ hasReusedPassword: true }),
    });

    expect(text()).not.toContain("passwordHasAdditionalRisks");
  });

  it("closes with true when exclude anyway is clicked", async () => {
    await initComponent();

    button("excludeAnyway").click();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it("closes without confirming when cancel is clicked", async () => {
    await initComponent();

    button("cancel").click();

    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    expect(dialogRef.close).not.toHaveBeenCalledWith(true);
  });
});
