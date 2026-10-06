import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { svg } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AgentAccessRequesterComponent } from "./agent-access-requester.component";

describe("AgentAccessRequesterComponent", () => {
  let fixture: ComponentFixture<AgentAccessRequesterComponent>;

  const setInputs = (inputs: Partial<AgentAccessRequesterComponent>) => {
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
  };

  beforeEach(async () => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [AgentAccessRequesterComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentAccessRequesterComponent);
    fixture.componentRef.setInput("name", "Claude Code");
    fixture.detectChanges();
  });

  it("renders the resolved name", () => {
    expect(fixture.nativeElement.textContent).toContain("Claude Code");
  });

  it("renders the descriptor line when provided", () => {
    setInputs({ descriptor: "Signed by Anthropic, Inc." });

    expect(fixture.nativeElement.textContent).toContain("Signed by Anthropic, Inc.");
  });

  it("omits the descriptor line when not provided", () => {
    // No descriptor input set beyond the required `name` from beforeEach.
    const helperSpans = fixture.debugElement.queryAll(By.css("[bittypography='helper']"));
    expect(helperSpans.length).toBe(0);
  });

  it("shows the neutral terminal glyph when no brand logo is resolved", () => {
    expect(fixture.nativeElement.querySelector("bit-icon.bwi-terminal")).not.toBeNull();
    expect(fixture.nativeElement.querySelector("bit-svg")).toBeNull();
  });

  it("renders the brand logo instead of the glyph when one is resolved", () => {
    setInputs({ brandLogo: svg`<svg></svg>` });

    expect(fixture.nativeElement.querySelector("bit-svg")).not.toBeNull();
    expect(fixture.nativeElement.querySelector("bit-icon.bwi-terminal")).toBeNull();
  });

  it("does not render the unverified warning strip by default", () => {
    expect(fixture.nativeElement.textContent).not.toContain(
      "agentAccessRequesterSignatureUnverified",
    );
  });

  it("renders the unverified warning strip when unverified", () => {
    setInputs({ unverified: true });

    expect(fixture.nativeElement.textContent).toContain("agentAccessRequesterSignatureUnverified");
  });
});
