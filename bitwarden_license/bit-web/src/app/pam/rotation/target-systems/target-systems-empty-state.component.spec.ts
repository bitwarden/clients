import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  TargetSystemsEmptyStateComponent,
  TargetSystemTemplateKey,
} from "./target-systems-empty-state.component";

describe("TargetSystemsEmptyStateComponent", () => {
  let fixture: ComponentFixture<TargetSystemsEmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TargetSystemsEmptyStateComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: { t: (id: string) => id } }],
    }).compileComponents();

    fixture = TestBed.createComponent(TargetSystemsEmptyStateComponent);
    fixture.detectChanges();
  });

  it("renders the hero create button and one button per template", () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector("#target-systems-empty-state_button_create")).toBeTruthy();
    (["manual", "entra", "active-directory", "custom-script"] as TargetSystemTemplateKey[]).forEach(
      (key) => {
        expect(el.querySelector(`#target-systems-empty-state_button_template-${key}`)).toBeTruthy();
      },
    );
  });

  it("emits useTemplate with the active-directory key, so the deep link is reachable from the UI", () => {
    const spy = jest.fn();
    fixture.componentInstance.useTemplate.subscribe(spy);
    (
      fixture.nativeElement.querySelector(
        "#target-systems-empty-state_button_template-active-directory",
      ) as HTMLButtonElement
    ).click();
    expect(spy).toHaveBeenCalledWith("active-directory");
  });

  it("emits create when the hero button is clicked", () => {
    const spy = jest.fn();
    fixture.componentInstance.create.subscribe(spy);
    (
      fixture.nativeElement.querySelector(
        "#target-systems-empty-state_button_create",
      ) as HTMLButtonElement
    ).click();
    expect(spy).toHaveBeenCalled();
  });

  it("emits useTemplate with the chosen key when a template button is clicked", () => {
    const spy = jest.fn();
    fixture.componentInstance.useTemplate.subscribe(spy);
    (
      fixture.nativeElement.querySelector(
        "#target-systems-empty-state_button_template-entra",
      ) as HTMLButtonElement
    ).click();
    expect(spy).toHaveBeenCalledWith("entra");
  });
});
