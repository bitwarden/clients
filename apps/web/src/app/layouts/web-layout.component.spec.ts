import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { GlobalStateProvider } from "@bitwarden/state";

import { WebLayoutComponent } from "./web-layout.component";

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

@Component({
  template: `<app-layout><p id="page">page</p></app-layout>`,
  imports: [WebLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

describe("WebLayoutComponent", () => {
  const i18nService = mock<I18nService>();

  beforeEach(async () => {
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: i18nService },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    }).compileComponents();
  });

  it("renders the private access banner link inside the layout's focus trap, before the page", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const trap = fixture.debugElement.query(By.css("bit-layout [cdkTrapFocus]"))
      .nativeElement as HTMLElement;
    const main = trap.querySelector("main") as HTMLElement;
    const link = main.querySelector("app-private-access-banner a") as HTMLAnchorElement;
    const page = main.querySelector("#page") as HTMLElement;

    expect(link).not.toBeNull();
    expect(link.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fixture.destroy();
  });
});
