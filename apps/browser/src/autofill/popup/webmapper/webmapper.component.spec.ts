import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { WebmapperDraftService } from "../../services/webmapper-draft.service";
import {
  addForm,
  addSelector,
  emptyDraft,
  setActiveForm,
  setCategory,
  WebmapperDraft,
} from "../../webmapper/draft";

import { WebmapperComponent } from "./webmapper.component";

const HOST = "example.com";
const PATH = "/login";

function fieldEntry(selector: string) {
  return { selector, warnings: [] as string[], alternates: [] as string[] };
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
  function listenerFor(event: unknown): (...args: any[]) => void {
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
    // Mirrors the real service: the mutation is applied to a copy of the draft as
    // it stands at write time, and the result is handed back to the caller.
    draftService.updateDraft.mockImplementation(async (_host, _pathname, fn) => {
      const next = JSON.parse(JSON.stringify(component.draft() ?? draft$.value)) as WebmapperDraft;
      fn(next);
      return next;
    });

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
    /** Mutations are keyed off the loaded page, so both signals must be set. */
    function loaded(draft: WebmapperDraft) {
      component.url.set({ host: HOST, pathname: PATH });
      component.draft.set(draft);
    }

    it("persists form-level actions through the draft service", () => {
      loaded(emptyDraft(HOST, PATH));

      component.setCategory(0, "login");
      expect(draftService.updateDraft).toHaveBeenCalledTimes(1);

      component.addForm();
      component.removeForm(1);
      component.setActiveForm(0);
      component.toggleIrrelevant();
      expect(draftService.updateDraft).toHaveBeenCalledTimes(5);
    });

    it("does nothing when no page is loaded", () => {
      component.url.set(null);
      component.draft.set(null);
      component.setCategory(0, "login");
      expect(draftService.updateDraft).not.toHaveBeenCalled();
    });

    it("edits a selector via startEdit/saveEdit and updates the signal", async () => {
      const draft = emptyDraft(HOST, PATH);
      addSelector(draft, component.fieldsSlot("username"), fieldEntry("#old"));
      loaded(draft);

      component.startEdit(component.addressAt(0, component.fieldsSlot("username"), 0), "#old");
      expect(component.editValue()).toBe("#old");

      component.editValue.set("#new");
      component.saveEdit();
      await flush();

      expect(draftService.updateDraft).toHaveBeenCalled();
      expect(component.draft()!.forms[0].fields.username[0].selector).toBe("#new");
      expect(component.editing()).toBeNull();
    });

    it("does not enter edit mode for a sequence (array) selector", () => {
      loaded(emptyDraft(HOST, PATH));
      component.startEdit(component.addressAt(0, component.fieldsSlot("username"), 0), ["a", "b"]);
      expect(component.editing()).toBeNull();
    });

    it("cancels the edit when the value is blank", () => {
      loaded(emptyDraft(HOST, PATH));
      component.editing.set(component.addressAt(0, component.fieldsSlot("username"), 0));
      component.editValue.set("   ");

      component.saveEdit();

      expect(component.editing()).toBeNull();
      expect(draftService.updateDraft).not.toHaveBeenCalled();
    });

    it("removes a selector and swaps an alternate through the service", () => {
      const draft = emptyDraft(HOST, PATH);
      addSelector(draft, component.fieldsSlot("username"), {
        selector: "#a",
        warnings: [],
        alternates: ["#b"],
      });
      loaded(draft);

      component.swapAlternate(component.addressAt(0, component.fieldsSlot("username"), 0), 0);
      component.removeSelector(component.addressAt(0, component.fieldsSlot("username"), 0));

      expect(draftService.updateDraft).toHaveBeenCalledTimes(2);
    });

    it("routes container actions through the service", () => {
      loaded(emptyDraft(HOST, PATH));
      component.pickContainer(0, 0);
      component.cancelContainer(0);
      expect(draftService.updateDraft).toHaveBeenCalledTimes(2);
    });
  });

  describe("copyJsonc", () => {
    it("copies the JSONC and toasts success for a valid draft", async () => {
      const draft = emptyDraft(HOST, PATH);
      setCategory(draft, 0, "login");
      addSelector(draft, component.fieldsSlot("username"), fieldEntry("#u"));
      component.draft.set(draft);

      await component.copyJsonc();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
        expect.stringContaining(HOST),
      );
      expect(component.exportText()).toContain(HOST);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("blocks export of an untouched (pristine) draft to avoid a spurious host-wide null", async () => {
      component.draft.set(emptyDraft(HOST, PATH));

      await component.copyJsonc();

      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(component.exportText()).toBeNull();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          message: expect.stringContaining("Nothing captured"),
        }),
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

    // The Export box is copyable text, so a superseded document must not linger.
    describe("the exported text does not survive a draft change", () => {
      it("drops it when a panel action mutates the draft", async () => {
        const draft = emptyDraft(HOST, PATH);
        setCategory(draft, 0, "login");
        addSelector(draft, component.fieldsSlot("username"), fieldEntry("#u"));
        component.url.set({ host: HOST, pathname: PATH });
        component.draft.set(draft);
        await component.copyJsonc();
        expect(component.exportText()).not.toBeNull();

        component.addForm();
        await flush();

        expect(component.exportText()).toBeNull();
      });

      it("drops it when a background capture lands", async () => {
        await component.ngOnInit();
        fixture.detectChanges();
        await flush();
        const draft = emptyDraft(HOST, PATH);
        setCategory(draft, 0, "login");
        addSelector(draft, component.fieldsSlot("username"), fieldEntry("#u"));
        draft$.next(draft);
        await flush();
        await component.copyJsonc();
        expect(component.exportText()).not.toBeNull();

        const captured = JSON.parse(JSON.stringify(draft)) as WebmapperDraft;
        addSelector(captured, component.fieldsSlot("password"), fieldEntry("#p"));
        draft$.next(captured);
        await flush();

        expect(component.exportText()).toBeNull();
      });
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

// The suite above stubs the template out, so no template binding is exercised there.
// This one renders the real template.
describe("WebmapperComponent template", () => {
  let component: WebmapperComponent;
  let fixture: ComponentFixture<WebmapperComponent>;
  let draftService: MockProxy<WebmapperDraftService>;
  let draft$: BehaviorSubject<WebmapperDraft>;
  let lastWritten: WebmapperDraft | null;

  const flush = () => new Promise((resolve) => setTimeout(resolve));

  /** Renders the component against a stored draft. */
  async function render(stored: WebmapperDraft): Promise<void> {
    draft$.next(stored);
    await component.ngOnInit();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
  }

  function byId<T extends HTMLElement>(id: string): T {
    return fixture.debugElement.query(By.css(`#${id}`))?.nativeElement as T;
  }

  /** The draft the component last wrote through the service. */
  function persisted(): WebmapperDraft {
    return lastWritten!;
  }

  beforeEach(async () => {
    lastWritten = null;
    draft$ = new BehaviorSubject<WebmapperDraft>(emptyDraft(HOST, PATH));
    draftService = mock<WebmapperDraftService>();
    draftService.draft$.mockReturnValue(draft$.asObservable());
    draftService.setDraft.mockResolvedValue(undefined);
    draftService.updateDraft.mockImplementation(async (_host, _pathname, fn) => {
      const next = JSON.parse(JSON.stringify(component.draft() ?? draft$.value)) as WebmapperDraft;
      fn(next);
      lastWritten = next;
      return next;
    });

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

    jest
      .spyOn(BrowserApi, "getCurrentTab")
      .mockResolvedValue({ id: 42, url: "https://example.com/login" } as chrome.tabs.Tab);
    jest.spyOn(BrowserApi, "addListener").mockImplementation(() => {});
    jest.spyOn(BrowserApi, "removeListener").mockImplementation(() => {});
    jest.spyOn(BrowserPopupUtils, "inSidePanel").mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [WebmapperComponent],
      providers: [
        provideNoopAnimations(),
        { provide: WebmapperDraftService, useValue: draftService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: { t: jest.fn((key: string) => key) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideProvider(DialogService, { useValue: mock<DialogService>() })
      .compileComponents();

    fixture = TestBed.createComponent(WebmapperComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("category dropdown", () => {
    it("shows the stored category when reopened on a draft that already has one", async () => {
      const stored = emptyDraft(HOST, PATH);
      setCategory(stored, 0, "account-login");

      await render(stored);

      const select = byId<HTMLSelectElement>("webmapper_select_category-0");
      expect(select.value).toBe("account-login");
      expect(select.selectedOptions[0].textContent.trim()).toBe("account-login");
    });

    it("shows the placeholder when the stored draft has no category", async () => {
      await render(emptyDraft(HOST, PATH));

      expect(byId<HTMLSelectElement>("webmapper_select_category-0").value).toBe("");
    });

    it("persists a category picked from the dropdown", async () => {
      await render(emptyDraft(HOST, PATH));

      const select = byId<HTMLSelectElement>("webmapper_select_category-0");
      select.value = "identity";
      select.dispatchEvent(new Event("change"));
      await flush();

      expect(persisted().forms[0].category).toBe("identity");
    });
  });

  describe("form list", () => {
    /** Two forms, the second active, each holding one field selector. */
    function twoForms(): WebmapperDraft {
      const draft = emptyDraft(HOST, PATH);
      addSelector(draft, component.fieldsSlot("username"), fieldEntry("#u0"));
      addForm(draft);
      setActiveForm(draft, 1);
      addSelector(draft, component.fieldsSlot("password"), fieldEntry("#p1"));
      return draft;
    }

    it("checks the radio of the active form only", async () => {
      await render(twoForms());

      expect(byId<HTMLInputElement>("webmapper_input_active-form-0").checked).toBe(false);
      expect(byId<HTMLInputElement>("webmapper_input_active-form-1").checked).toBe(true);
    });

    it("badges a draft marked irrelevant", async () => {
      const stored = emptyDraft(HOST, PATH);
      stored.irrelevant = true;

      await render(stored);

      expect(fixture.nativeElement.textContent).toContain("irrelevant");
    });

    it("lists the validation issues blocking export", async () => {
      const stored = emptyDraft(HOST, PATH);
      // Field selectors with no category is the canonical pre-export failure.
      addSelector(stored, component.fieldsSlot("username"), fieldEntry("#u"));

      await render(stored);

      const issues = component.issues();
      expect(issues.length).toBeGreaterThan(0);
      for (const issue of issues) {
        expect(fixture.nativeElement.textContent).toContain(issue);
      }
    });

    it("gives every repeated control a unique id", async () => {
      await render(twoForms());

      const ids = Array.from(fixture.nativeElement.querySelectorAll("[id]")).map(
        (el) => (el as HTMLElement).id,
      );

      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toHaveLength(new Set(ids).size);
    });
  });

  describe("selector entries", () => {
    it("renders the selector and switches to edit mode", async () => {
      const stored = emptyDraft(HOST, PATH);
      addSelector(stored, component.fieldsSlot("username"), fieldEntry("#user"));

      await render(stored);
      expect(fixture.nativeElement.textContent).toContain("#user");

      byId("webmapper_button_edit-selector-0-fields-username-0").click();
      fixture.detectChanges();

      const input = byId<HTMLInputElement>("webmapper_input_edit-selector-0-fields-username-0");
      expect(input.value).toBe("#user");
    });

    // `editing` is a positional address, so anything that renumbers or replaces
    // entries must drop it — otherwise the pending text lands in the wrong entry.
    describe("a pending edit does not survive a structural change", () => {
      /** Three username selectors, with an edit pending on the middle one. */
      async function editingTheMiddleOf(stored: WebmapperDraft): Promise<void> {
        for (const sel of ["#a", "#b", "#c"]) {
          addSelector(stored, component.fieldsSlot("username"), fieldEntry(sel));
        }
        await render(stored);

        byId("webmapper_button_edit-selector-0-fields-username-1").click();
        fixture.detectChanges();
        expect(component.editValue()).toBe("#b");
      }

      it("removing an earlier selector does not overwrite the one that inherits the index", async () => {
        const stored = emptyDraft(HOST, PATH);
        await editingTheMiddleOf(stored);

        byId("webmapper_button_remove-selector-0-fields-username-0").click();
        await flush();
        fixture.detectChanges();

        expect(component.editing()).toBeNull();
        expect(persisted().forms[0].fields.username.map((e) => e.selector)).toEqual(["#b", "#c"]);
      });

      it("swapping an alternate under the edited entry does not overwrite the swap", async () => {
        const stored = emptyDraft(HOST, PATH);
        addSelector(stored, component.fieldsSlot("username"), {
          selector: "#chosen",
          warnings: [],
          alternates: ["#alt"],
        });
        await render(stored);

        byId("webmapper_button_edit-selector-0-fields-username-0").click();
        fixture.detectChanges();

        // The alternates row renders outside the edit branch, so it stays clickable.
        byId("webmapper_button_use-alternate-0-fields-username-0-0").click();
        await flush();
        fixture.detectChanges();

        expect(component.editing()).toBeNull();
        expect(persisted().forms[0].fields.username[0].selector).toBe("#alt");
      });

      it("removing a form drops an edit pending in another form", async () => {
        const stored = emptyDraft(HOST, PATH);
        addSelector(stored, component.fieldsSlot("username"), fieldEntry("#form0"));
        addForm(stored);
        setActiveForm(stored, 1);
        addSelector(stored, component.fieldsSlot("username"), fieldEntry("#form1"));
        await render(stored);

        byId("webmapper_button_edit-selector-1-fields-username-0").click();
        fixture.detectChanges();
        expect(component.editValue()).toBe("#form1");

        byId("webmapper_button_remove-form-0").click();
        await flush();
        fixture.detectChanges();

        expect(component.editing()).toBeNull();
        expect(persisted().forms).toHaveLength(1);
        expect(persisted().forms[0].fields.username[0].selector).toBe("#form1");
      });

      it("drops an edit when the panel follows the browser to another page", async () => {
        const stored = emptyDraft(HOST, PATH);
        addSelector(stored, component.fieldsSlot("username"), fieldEntry("#u"));
        await render(stored);

        byId("webmapper_button_edit-selector-0-fields-username-0").click();
        fixture.detectChanges();
        expect(component.editing()).not.toBeNull();

        jest
          .spyOn(BrowserApi, "getCurrentTab")
          .mockResolvedValue({ id: 43, url: "https://other.test/signup" } as chrome.tabs.Tab);
        await component.ngOnInit();
        await flush();

        expect(component.editing()).toBeNull();
      });
    });

    it("disables editing for a sequence selector", async () => {
      const stored = emptyDraft(HOST, PATH);
      addSelector(stored, component.fieldsSlot("username"), {
        selector: ["#step1", "#step2"],
        warnings: [],
        alternates: [],
      });

      await render(stored);

      // bitIconButton marks disabled with aria-disabled rather than the native
      // attribute, so the button stays focusable; a document-level capture
      // listener is what actually swallows the click.
      const edit = byId<HTMLButtonElement>("webmapper_button_edit-selector-0-fields-username-0");
      expect(edit.getAttribute("aria-disabled")).toBe("true");

      edit.click();
      fixture.detectChanges();

      expect(component.editing()).toBeNull();
    });
  });
});
