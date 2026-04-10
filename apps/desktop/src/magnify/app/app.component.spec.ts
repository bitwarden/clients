import { ComponentFixture, TestBed } from "@angular/core/testing";

import { MagnifyAuthStatus } from "../../autofill/models/magnify-commands";
import { CommandService } from "../services/command-service";

import { AppComponent } from "./app.component";

describe("AppComponent", () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  const mockCommandService = {
    getAuthStatus: jest.fn().mockResolvedValue(MagnifyAuthStatus.Unlocked),
    resize: jest.fn(),
    focusBitwarden: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    })
      .overrideComponent(AppComponent, {
        set: {
          providers: [{ provide: CommandService, useValue: mockCommandService }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates the component", () => {
    expect(component).toBeTruthy();
  });

  it("renders search-bar when unlocked", async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector("search-bar")).toBeTruthy();
  });

  it("renders vault-auth-status when locked", async () => {
    mockCommandService.getAuthStatus.mockResolvedValue(MagnifyAuthStatus.Locked);
    fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector("vault-auth-status")).toBeTruthy();
  });

  it("defaults to locked state when getAuthStatus rejects", async () => {
    mockCommandService.getAuthStatus.mockRejectedValue(new Error("IPC failed"));
    fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector("vault-auth-status")).toBeTruthy();
  });
});
