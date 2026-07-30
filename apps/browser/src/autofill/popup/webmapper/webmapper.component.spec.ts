import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { WebmapperDraftService } from "../../services/webmapper-draft.service";
import { addSelector, emptyDraft, setCategory, WebmapperDraft } from "../../webmapper/draft";

import { WebmapperComponent } from "./webmapper.component";

const HOST = "example.com";
const PATH = "/login";

function fieldEntry(selector: string) {
  return { selector, warnings: [], alternates: [] as string[] };
}

describe("WebmapperComponent", () => {
  let component: WebmapperComponent;
  let fixture: ComponentFixture<WebmapperComponent>;
  let draftService: MockProxy<WebmapperDraftService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;
  let dialogService: MockProxy<DialogService>;
  let draft$: BehaviorSubject<WebmapperDraft>;

  const mockTab = { id: 42, url: "https://example.com/login" } as chrome.tabs.Tab;

  /** Finds the listener the component registered for a given chrome event. */
  function listenerFor(event: unknown): (msg: any) => void {
    const call = (BrowserApi.addListener as jest.Mock).mock.calls.find((c) => c[0] === event);
    return call?.[1];
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(async () => {
    draft$ = new BehaviorSubject<WebmapperDraft>(emptyDraft(HOST, PATH));
    draftService = mock<WebmapperDraftService>();
    draftService.draft$.mockReturnValue(draft$.asObservable());
    draftService.setDraft.mockResolvedValue(undefined);
    draftService.clearDraft.mockResolvedValue(undefined);

    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    global.chrome = {
      tabs: {
        onActivated: { addListener: jest.fn(), removeListener: jest.fn() },
        onUpdated: { addListener: jest.fn(), removeListener: jest.fn() },
      },
      runtime: {
        onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
        sendMessage: jest.fn(),
      },
    } as any;

    jest.spyOn(BrowserApi, "getCurrentTab").mockResolvedValue(mockTab);
    jest.spyOn(BrowserApi, "addListener").mockImplementation(() => {});
    jest.spyOn(BrowserApi, "removeListener").mockImplementation(() => {});
    jest.spyOn(BrowserPopupUtils, "inSidePanel").mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [WebmapperComponent],
      providers: [
        provideNoopAnimations(),
        { provide: WebmapperDraftService, useValue: draftService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: toastService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(WebmapperComponent, { set: { template: "" } })
      .overrideProvider(DialogService, { useValue: dialogService })
      .compileComponents();

    fixture = TestBed.createComponent(WebmapperComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("loading for the active tab", () => {
    it("parses the tab url and loads its draft on init", async () => {
      await component.ngOnInit();
      fixture.detectChanges();
      await flush();

      expect(component.url()).toEqual({ host: HOST, pathname: PATH });
      expect(draftService.draft$).toHaveBeenCalledWith(HOST, PATH);
      expect(component.draft()).toEqual(emptyDraft(HOST, PATH));
    });

    it("reflects a stored draft change live (background capture → open panel)", async () => {
      await component.ngOnInit();
      fixture.detectChanges();
      await flush();

      const updated = emptyDraft(HOST, PATH);
      setCategory(updated, 0, "login");
      draft$.next(updated);
      fixture.detectChanges();
      await flush();

      expect(component.draft()).toEqual(updated);
    });

    it("falls back to the active-window tab when in the side panel", async () => {
      jest.spyOn(BrowserApi, "getCurrentTab").mockResolvedValue(null);
      jest.spyOn(BrowserPopupUtils, "inSidePanel").mockReturnValue(true);
      const tabsQuery = jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([mockTab]);

      await component.ngOnInit();

      expect(tabsQuery).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(component.url()).toEqual({ host: HOST, pathname: PATH });
    });

    it("clears the url when the active tab has no url", async () => {
      jest.spyOn(BrowserApi, "getCurrentTab").mockResolvedValue({ id: 7 } as chrome.tabs.Tab);

      await component.ngOnInit();

      expect(component.url()).toBeNull();
    });
  });

  describe("listeners", () => {
    it("registers tab and message listeners on init and removes them on destroy", async () => {
      await component.ngOnInit();
      expect(BrowserApi.addListener).toHaveBeenCalledTimes(3);

      component.ngOnDestroy();
      expect(BrowserApi.removeListener).toHaveBeenCalledTimes(3);
    });

    it("reloads when the active tab changes", async () => {
      await component.ngOnInit();
      (BrowserApi.getCurrentTab as jest.Mock).mockClear();

      listenerFor(chrome.tabs.onActivated)(undefined);
      await flush();

      expect(BrowserApi.getCurrentTab).toHaveBeenCalled();
    });

    it("reloads on tab update only when the url changes", async () => {
      await component.ngOnInit();
      (BrowserApi.getCurrentTab as jest.Mock).mockClear();
      const onUpdated = listenerFor(chrome.tabs.onUpdated);

      onUpdated(42, {});
      await flush();
      expect(BrowserApi.getCurrentTab).not.toHaveBeenCalled();

      onUpdated(42, { url: "https://example.com/other" });
      await flush();
      expect(BrowserApi.getCurrentTab).toHaveBeenCalled();
    });

    it("shows a toast for a capture-feedback message on the current tab", async () => {
      await component.ngOnInit();

      listenerFor(chrome.runtime.onMessage)({
        command: "webmapperCaptureFeedback",
        tabId: 42,
        type: "success",
        message: "Captured username",
      });

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "",
        message: "Captured username",
      });
    });

    it("ignores feedback for a different tab or a different command", async () => {
      await component.ngOnInit();
      const onMessage = listenerFor(chrome.runtime.onMessage);

      onMessage({ command: "webmapperCaptureFeedback", tabId: 999, message: "x" });
      onMessage({ command: "somethingElse", tabId: 42, message: "x" });

      expect(toastService.showToast).not.toHaveBeenCalled();
    });
  });

  describe("template helpers", () => {
    it("renders selector text for single and sequence values", () => {
      expect(component.selectorText("#user")).toBe("#user");
      expect(component.selectorText(["a", "b"])).toBe("a  /  b");
      expect(component.isArraySelector("#user")).toBe(false);
      expect(component.isArraySelector(["a"])).toBe(true);
    });

    it("lists the keys of a selector map", () => {
      expect(component.keysOf({ username: [], password: [] })).toEqual(["username", "password"]);
    });

    it("builds typed slot addresses and matches the one being edited", () => {
      const address = component.addressAt(0, component.fieldsSlot("username"), 1);
      component.editing.set(address);

      expect(component.isEditing(address)).toBe(true);
      // Different index, different key, and a container slot must all not match.
      expect(component.isEditing(component.addressAt(0, component.fieldsSlot("username"), 2))).toBe(
        false,
      );
      expect(component.isEditing(component.addressAt(0, component.fieldsSlot("password"), 1))).toBe(
        false,
      );
      expect(component.isEditing(component.addressAt(0, component.containerSlot, 1))).toBe(false);
    });

    it("matches two container-slot addresses regardless of key", () => {
      const address = component.addressAt(0, component.containerSlot, 0);
      component.editing.set(address);
      expect(component.isEditing(component.addressAt(0, component.containerSlot, 0))).toBe(true);
    });

    it("builds actions slots", () => {
      expect(component.actionsSlot("submit")).toEqual({ kind: "actions", key: "submit" });
    });

    it("exposes validation issues, empty when no draft is loaded", () => {
      component.draft.set(null);
      expect(component.issues()).toEqual([]);

      const invalid = emptyDraft(HOST, PATH);
      addSelector(invalid, component.fieldsSlot("username"), fieldEntry("#u")); // no category
      component.draft.set(invalid);
      expect(component.issues().length).toBeGreaterThan(0);
    });
  });

  describe("draft mutations", () => {
    it("persists form-level actions through the draft service", () => {
      component.draft.set(emptyDraft(HOST, PATH));

      component.setCategory(0, "login");
      expect(draftService.setDraft).toHaveBeenCalledTimes(1);

      component.addForm();
      component.removeForm(1);
      component.setActiveForm(0);
      component.toggleIrrelevant();
      expect(draftService.setDraft).toHaveBeenCalledTimes(5);
    });

    it("does nothing when there is no loaded draft", () => {
      component.draft.set(null);
      component.setCategory(0, "login");
      expect(draftService.setDraft).not.toHaveBeenCalled();
    });

    it("edits a selector via startEdit/saveEdit and updates the signal", async () => {
      const draft = emptyDraft(HOST, PATH);
      addSelector(draft, component.fieldsSlot("username"), fieldEntry("#old"));
      component.draft.set(draft);

      component.startEdit(component.addressAt(0, component.fieldsSlot("username"), 0), "#old");
      expect(component.editValue()).toBe("#old");

      component.editValue.set("#new");
      component.saveEdit();
      await flush();

      expect(draftService.setDraft).toHaveBeenCalled();
      expect(component.draft()!.forms[0].fields.username[0].selector).toBe("#new");
      expect(component.editing()).toBeNull();
    });

    it("does not enter edit mode for a sequence (array) selector", () => {
      component.draft.set(emptyDraft(HOST, PATH));
      component.startEdit(component.addressAt(0, component.fieldsSlot("username"), 0), ["a", "b"]);
      expect(component.editing()).toBeNull();
    });

    it("cancels the edit when the value is blank", () => {
      component.draft.set(emptyDraft(HOST, PATH));
      component.editing.set(component.addressAt(0, component.fieldsSlot("username"), 0));
      component.editValue.set("   ");

      component.saveEdit();

      expect(component.editing()).toBeNull();
      expect(draftService.setDraft).not.toHaveBeenCalled();
    });

    it("removes a selector and swaps an alternate through the service", () => {
      const draft = emptyDraft(HOST, PATH);
      addSelector(draft, component.fieldsSlot("username"), {
        selector: "#a",
        warnings: [],
        alternates: ["#b"],
      });
      component.draft.set(draft);

      component.swapAlternate(component.addressAt(0, component.fieldsSlot("username"), 0), 0);
      component.removeSelector(component.addressAt(0, component.fieldsSlot("username"), 0));

      expect(draftService.setDraft).toHaveBeenCalledTimes(2);
    });

    it("routes container actions through the service", () => {
      component.draft.set(emptyDraft(HOST, PATH));
      component.pickContainer(0, 0);
      component.cancelContainer(0);
      expect(draftService.setDraft).toHaveBeenCalledTimes(2);
    });
  });

  describe("copyJsonc", () => {
    it("copies the JSONC and toasts success for a valid draft", async () => {
      component.draft.set(emptyDraft(HOST, PATH));

      await component.copyJsonc();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
        expect.stringContaining(HOST),
      );
      expect(component.exportText()).toContain(HOST);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("blocks export and toasts an error when the draft has issues", async () => {
      const draft = emptyDraft(HOST, PATH);
      // A form with field selectors but no category fails validation.
      addSelector(draft, component.fieldsSlot("username"), fieldEntry("#u"));
      component.draft.set(draft);

      await component.copyJsonc();

      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("does nothing when there is no draft", async () => {
      component.draft.set(null);
      await component.copyJsonc();
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });
  });

  describe("clearDraft", () => {
    it("clears the stored draft after confirmation", async () => {
      component.url.set({ host: HOST, pathname: PATH });
      component.exportText.set("stale");

      await component.clearDraft();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ type: "warning" }),
      );
      expect(draftService.clearDraft).toHaveBeenCalledWith(HOST, PATH);
      expect(component.exportText()).toBeNull();
    });

    it("does not clear when the user cancels", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      component.url.set({ host: HOST, pathname: PATH });

      await component.clearDraft();

      expect(draftService.clearDraft).not.toHaveBeenCalled();
    });

    it("does nothing when there is no url", async () => {
      component.url.set(null);
      await component.clearDraft();
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });
  });
});
