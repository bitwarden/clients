import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DIALOG_DATA, DialogRef } from "../../dialog";
import { I18nMockService } from "../../utils/i18n-mock.service";

import {
  CustomizeColumnsDialogComponent,
  CustomizeColumnsDialogParams,
} from "./customize-columns-dialog.component";

describe("CustomizeColumnsDialogComponent", () => {
  let fixture: ComponentFixture<CustomizeColumnsDialogComponent>;
  let hidden: ReturnType<typeof signal<ReadonlySet<string>>>;
  let setHidden: jest.Mock<void, [string, boolean]>;
  let reset: jest.Mock<void, []>;

  beforeEach(async () => {
    hidden = signal<ReadonlySet<string>>(new Set(["folder"]));
    setHidden = jest.fn();
    reset = jest.fn();

    const params: CustomizeColumnsDialogParams = {
      columns: [
        { name: "vault", label: "Vault" },
        { name: "folder", label: "Folder" },
      ],
      hidden,
      setHidden,
      reset,
    };

    await TestBed.configureTestingModule({
      imports: [CustomizeColumnsDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: { close: jest.fn() } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              customizeYourView: "Customize your view",
              showColumns: "Show columns",
              resetToDefault: "Reset to default",
              done: "Done",
              close: "Close",
              columnShown: (name?: string) => `${name} column shown`,
              columnHidden: (name?: string) => `${name} column hidden`,
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomizeColumnsDialogComponent);
    fixture.detectChanges();
  });

  /** The component's protected form and reset, reached the way its own template would. */
  const internals = () =>
    fixture.componentInstance as unknown as {
      form: FormGroup<Record<string, FormControl<boolean | null>>>;
      resetToDefault(): void;
    };
  const form = () => internals().form;

  it("titles the switch group", () => {
    expect(fixture.nativeElement.querySelector("legend")!.textContent).toContain("Show columns");
  });

  it("labels each switch with its column's label", () => {
    const labels = [...fixture.nativeElement.querySelectorAll("bit-form-control-card bit-label")];
    expect(labels.map((l: Element) => l.textContent!.trim())).toEqual(["Vault", "Folder"]);
  });

  it("starts each switch from the column's current visibility", () => {
    expect(form().value).toEqual({ vault: true, folder: false });
  });

  it("hides a column as soon as its switch moves", () => {
    form().patchValue({ vault: false });

    expect(setHidden).toHaveBeenCalledWith("vault", true);
  });

  it("shows a column again", () => {
    form().patchValue({ folder: true });

    expect(setHidden).toHaveBeenCalledWith("folder", false);
  });

  it("forwards only the switch that moved", () => {
    form().patchValue({ vault: false });

    expect(setHidden).toHaveBeenCalledTimes(1);
  });

  it("does not re-forward a switch set to the value it already has", () => {
    form().patchValue({ vault: true });

    expect(setHidden).not.toHaveBeenCalled();
  });

  it("forwards the second of two quick changes, rather than repeating the first", () => {
    // The table's hidden set is written asynchronously, so it is still stale here. The
    // dialog has to diff against what it last sent.
    form().patchValue({ vault: false });
    form().patchValue({ folder: true });

    expect(setHidden.mock.calls).toEqual([
      ["vault", true],
      ["folder", false],
    ]);
  });

  describe("the reset control", () => {
    const resetButton = () =>
      [...fixture.nativeElement.querySelectorAll("button")].find((button: HTMLButtonElement) =>
        button.textContent?.includes("Reset to default"),
      ) ?? null;

    it("is offered when a column starts hidden", () => {
      expect(resetButton()).not.toBeNull();
    });

    it("is withheld while every column is shown", async () => {
      // `folder` starts hidden, so this fixture opens already modified; show it again.
      form().patchValue({ folder: true });
      fixture.detectChanges();

      expect(resetButton()).toBeNull();
    });

    it("appears as soon as a column is hidden", async () => {
      form().patchValue({ folder: true });
      fixture.detectChanges();
      expect(resetButton()).toBeNull();

      form().patchValue({ vault: false });
      fixture.detectChanges();

      expect(resetButton()).not.toBeNull();
    });

    it("withdraws itself once reset puts everything back", () => {
      internals().resetToDefault();
      fixture.detectChanges();

      expect(resetButton()).toBeNull();
    });
  });

  it("turns every switch back on when reset, without forwarding the changes", () => {
    internals().resetToDefault();

    expect(reset).toHaveBeenCalled();
    expect(form().value).toEqual({ vault: true, folder: true });
    expect(setHidden).not.toHaveBeenCalled();
  });

  it("reports a column moved after a reset, rather than treating it as unchanged", () => {
    internals().resetToDefault();
    form().patchValue({ folder: false });

    expect(setHidden).toHaveBeenCalledWith("folder", true);
  });
});
