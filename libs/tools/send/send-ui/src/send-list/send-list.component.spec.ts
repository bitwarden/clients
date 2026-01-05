import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SendItemsService } from "../services/send-items.service";

import { SendListComponent } from "./send-list.component";

describe("SendListComponent", () => {
  let component: SendListComponent;
  let fixture: ComponentFixture<SendListComponent>;
  let i18nService: MockProxy<I18nService>;
  let sendItemsService: MockProxy<SendItemsService>;

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    // Mock SendItemsService for SendSearchComponent child component
    sendItemsService = mock<SendItemsService>();
    sendItemsService.latestSearchText$ = of("");

    await TestBed.configureTestingModule({
      imports: [SendListComponent],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: SendItemsService, useValue: sendItemsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendListComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should display empty state when listState is Empty", () => {
    fixture.componentRef.setInput("sends", []);
    fixture.componentRef.setInput("listState", "Empty");
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain("sendsTitleNoItems");
  });

  it("should display no results state when listState is NoResults", () => {
    fixture.componentRef.setInput("sends", []);
    fixture.componentRef.setInput("listState", "NoResults");
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    // Component shows same empty state for both Empty and NoResults states
    expect(compiled.textContent).toContain("sendsTitleNoItems");
  });

  it("should emit editSend event when send is edited", () => {
    const editSpy = jest.fn();
    component.editSend.subscribe(editSpy);

    const mockSend = { id: "test-id", name: "Test Send" } as any;
    component["onEditSend"](mockSend);

    expect(editSpy).toHaveBeenCalledWith(mockSend);
  });

  it("should emit copySend event when send link is copied", () => {
    const copySpy = jest.fn();
    component.copySend.subscribe(copySpy);

    const mockSend = { id: "test-id", name: "Test Send" } as any;
    component["onCopySend"](mockSend);

    expect(copySpy).toHaveBeenCalledWith(mockSend);
  });

  it("should emit deleteSend event when send is deleted", () => {
    const deleteSpy = jest.fn();
    component.deleteSend.subscribe(deleteSpy);

    const mockSend = { id: "test-id", name: "Test Send" } as any;
    component["onDeleteSend"](mockSend);

    expect(deleteSpy).toHaveBeenCalledWith(mockSend);
  });
});
