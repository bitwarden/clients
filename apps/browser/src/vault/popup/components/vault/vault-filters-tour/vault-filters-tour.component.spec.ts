import { ElementRef, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BitTableToolbarComponent, PopoverRef, PopoverService } from "@bitwarden/components";
import { CoachmarkService, CoachmarkStepId } from "@bitwarden/vault";

import {
  SharedFoldersRow,
  VaultPopupTourService,
} from "../../../services/vault-popup-tour.service";

import { VaultFiltersTourComponent } from "./vault-filters-tour.component";

describe("VaultFiltersTourComponent", () => {
  let fixture: ComponentFixture<VaultFiltersTourComponent>;
  let popoverRef: PopoverRef;

  /** The tour's active step, read through the signal so the component's effects track it. */
  const activeStep = signal<CoachmarkStepId | null>(null);
  const coachmarkService = mock<CoachmarkService>({
    isStepActive: (stepId: CoachmarkStepId) => activeStep() === stepId,
  });
  /** The filter dialog row the tour picked for its shared folders step. */
  const sharedFoldersRow = signal<SharedFoldersRow | null>("collection");
  /** Whether the tour holds the filter dialog open. */
  const filterDialogOpen = signal(false);
  const popoverService = mock<PopoverService>();

  /** Stands in for the toolbar's anchors, which only render in a laid-out filter dialog. */
  const filterButton = signal(new ElementRef(document.createElement("button")));
  const rows = {
    collection: signal(new ElementRef(document.createElement("div"))),
    folder: signal(new ElementRef(document.createElement("div"))),
  };
  const toolbar = {
    filterButton,
    filterRow: (key: SharedFoldersRow) => rows[key],
  } as unknown as BitTableToolbarComponent;

  beforeEach(async () => {
    jest.clearAllMocks();
    activeStep.set(null);
    sharedFoldersRow.set("collection");
    filterDialogOpen.set(false);
    popoverRef = new PopoverRef(() => {});
    jest.spyOn(popoverRef, "close");
    popoverService.open.mockReturnValue(popoverRef);

    await TestBed.configureTestingModule({
      imports: [VaultFiltersTourComponent],
      providers: [
        { provide: CoachmarkService, useValue: coachmarkService },
        { provide: VaultPopupTourService, useValue: { sharedFoldersRow, filterDialogOpen } },
        { provide: PopoverService, useValue: popoverService },
        { provide: I18nService, useValue: mock<I18nService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultFiltersTourComponent);
    fixture.componentRef.setInput("toolbar", toolbar);
    fixture.detectChanges();
  });

  it("opens nothing while neither filter step is active", () => {
    expect(popoverService.open).not.toHaveBeenCalled();
  });

  it("anchors the filters step to the toolbar's filter button", () => {
    activeStep.set("filters");
    fixture.detectChanges();

    expect(popoverService.open).toHaveBeenCalledWith(
      expect.anything(),
      filterButton,
      expect.objectContaining({ spotlight: true }),
    );
  });

  it("opens the filter dialog and anchors the Shared folders row for the shared folders step", () => {
    activeStep.set("sharedFolders");
    fixture.detectChanges();

    expect(filterDialogOpen()).toBe(true);
    expect(popoverService.open).toHaveBeenCalledWith(
      expect.anything(),
      rows.collection,
      expect.objectContaining({ spotlight: true }),
    );
  });

  it("anchors the My folders row for the shared folders step when the tour picked it", () => {
    sharedFoldersRow.set("folder");
    activeStep.set("sharedFolders");
    fixture.detectChanges();

    expect(popoverService.open).toHaveBeenCalledWith(
      expect.anything(),
      rows.folder,
      expect.objectContaining({ spotlight: true }),
    );
  });

  it("leaves the filter dialog closed when the tour has no row for the shared folders step", () => {
    sharedFoldersRow.set(null);
    activeStep.set("sharedFolders");
    fixture.detectChanges();

    expect(filterDialogOpen()).toBe(false);
    expect(popoverService.open).not.toHaveBeenCalled();
  });

  it("closes the filter dialog when the tour leaves the shared folders step", () => {
    activeStep.set("sharedFolders");
    fixture.detectChanges();

    activeStep.set("filters");
    fixture.detectChanges();

    expect(popoverRef.close).toHaveBeenCalled();
    expect(filterDialogOpen()).toBe(false);
    expect(coachmarkService.completeTour).not.toHaveBeenCalled();
  });

  it("ends the tour when the user closes the filter dialog during the shared folders step", () => {
    activeStep.set("sharedFolders");
    fixture.detectChanges();

    filterDialogOpen.set(false);
    fixture.detectChanges();

    expect(coachmarkService.completeTour).toHaveBeenCalled();
  });
});
