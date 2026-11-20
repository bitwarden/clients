import {
  addForm,
  addSelector,
  cancelPendingContainer,
  ContainerCandidate,
  editSelectorAt,
  emptyDraft,
  emptyForm,
  fieldSelectorsForActive,
  isDraftPristine,
  pickContainerCandidate,
  removeForm,
  removeSelectorAt,
  SelectorEntry,
  setActiveForm,
  setCategory,
  setPendingContainer,
  Slot,
  swapAlternateAt,
  toggleIrrelevant,
  toJsonc,
  validateDraft,
  WebmapperDraft,
} from "./draft";

function captured(
  selector: SelectorEntry["selector"],
  warnings: string[] = [],
  alternates: SelectorEntry["alternates"] = [],
): SelectorEntry {
  return { selector, warnings, alternates };
}

const fieldSlot = (key: string): Slot => ({ kind: "fields", key });
const actionSlot = (key: string): Slot => ({ kind: "actions", key });
const containerSlot = (): Slot => ({ kind: "container" });

// Container candidate with sensible defaults; tests override what they exercise.
function candidate(partial: Partial<ContainerCandidate>): ContainerCandidate {
  return {
    selector: "form#x",
    label: "candidate",
    tag: "form",
    structural: false,
    warnings: [],
    ...partial,
  };
}

describe("draft constructors", () => {
  it("emptyForm() returns the documented shape", () => {
    expect(emptyForm()).toEqual({
      category: null,
      container: null,
      fields: {},
      actions: {},
      pendingContainer: null,
    });
  });

  it("emptyDraft() seeds with one empty form and activeFormIndex 0", () => {
    const d = emptyDraft("example.com", "/login");
    expect(d.host).toBe("example.com");
    expect(d.pathname).toBe("/login");
    expect(d.irrelevant).toBe(false);
    expect(d.activeFormIndex).toBe(0);
    expect(d.forms.length).toBe(1);
  });

  it("emptyDraft() coerces undefined pathname to null", () => {
    expect(emptyDraft("example.com", null).pathname).toBeNull();
  });
});

describe("addSelector", () => {
  it("pushes a captured entry under the field key", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, fieldSlot("username"), captured("input#email", ["w"], ["alt"]));
    expect(d.forms[0].fields.username).toEqual([
      { selector: "input#email", warnings: ["w"], alternates: ["alt"] },
    ]);
  });

  it("dedups on the selector string (warnings/alternates ignored for dedup)", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, fieldSlot("username"), captured("input#email", ["one"]));
    addSelector(d, fieldSlot("username"), captured("input#email", ["two"]));
    expect(d.forms[0].fields.username.length).toBe(1);
    expect(d.forms[0].fields.username[0].warnings).toEqual(["one"]);
  });

  it("on actions behaves analogously to fields", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, actionSlot("submit"), captured("button#go"));
    addSelector(d, actionSlot("submit"), captured("button#go"));
    addSelector(d, actionSlot("submit"), captured("button.alt"));
    expect(d.forms[0].actions.submit.length).toBe(2);
  });

  it("targets the active form, not always form[0]", () => {
    const d = emptyDraft("example.com", "/login");
    addForm(d); // activeFormIndex now 1
    addSelector(d, fieldSlot("username"), captured("input#in-form-1"));
    expect(d.forms[0].fields.username).toBeUndefined();
    expect(d.forms[1].fields.username[0].selector).toBe("input#in-form-1");
  });

  it("rejects the container slot (use pickContainerCandidate)", () => {
    const d = emptyDraft("example.com", "/login");
    expect(() => addSelector(d, containerSlot(), captured("form#x"))).toThrow();
  });
});

describe("container workflow", () => {
  it("pickContainerCandidate sets the container and clears pending", () => {
    const d = emptyDraft("example.com", "/login");
    setPendingContainer(d, [
      candidate({ selector: "form#a", label: "a" }),
      candidate({ selector: "form#b", label: "b", warnings: ["warn"] }),
    ]);
    pickContainerCandidate(d, 0, 1);
    expect(d.forms[0].container).toEqual([
      { selector: "form#b", warnings: ["warn"], alternates: [] },
    ]);
    expect(d.forms[0].pendingContainer).toBeNull();
  });

  it("cancelPendingContainer clears candidates without setting the container", () => {
    const d = emptyDraft("example.com", "/login");
    setPendingContainer(d, [candidate({ selector: "form#a" })]);
    cancelPendingContainer(d, 0);
    expect(d.forms[0].pendingContainer).toBeNull();
    expect(d.forms[0].container).toBeNull();
  });

  it("removeSelectorAt on container nulls the slot when emptied", () => {
    const d = emptyDraft("example.com", "/login");
    setPendingContainer(d, [candidate({ selector: "form#x" })]);
    pickContainerCandidate(d, 0, 0);
    removeSelectorAt(d, 0, containerSlot(), 0);
    expect(d.forms[0].container).toBeNull();
  });
});

describe("editSelectorAt", () => {
  it("replaces the selector and clears warnings (alternates preserved)", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, fieldSlot("username"), captured("input#one", ["w"], ["alt"]));
    editSelectorAt(d, 0, fieldSlot("username"), 0, "input#two");
    expect(d.forms[0].fields.username[0]).toEqual({
      selector: "input#two",
      warnings: [],
      alternates: ["alt"],
    });
  });

  it("works the same way for actions and container", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, actionSlot("submit"), captured("button#a", ["w"]));
    editSelectorAt(d, 0, actionSlot("submit"), 0, "button#b");
    expect(d.forms[0].actions.submit[0].selector).toBe("button#b");

    setPendingContainer(d, [candidate({ selector: "form#a", warnings: ["w"] })]);
    pickContainerCandidate(d, 0, 0);
    editSelectorAt(d, 0, containerSlot(), 0, "form#b");
    expect(d.forms[0].container![0].selector).toBe("form#b");
  });
});

describe("swapAlternateAt", () => {
  it("moves the current selector to the head of alternates", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, fieldSlot("username"), captured("input#one", [], ["alt-a", "alt-b"]));
    swapAlternateAt(d, 0, fieldSlot("username"), 0, 0);
    expect(d.forms[0].fields.username[0]).toEqual({
      selector: "alt-a",
      warnings: [],
      alternates: ["input#one", "alt-b"],
    });
  });

  it("is reversible (current cycles back through alternates)", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, fieldSlot("username"), captured("A", [], ["B", "C"]));
    swapAlternateAt(d, 0, fieldSlot("username"), 0, 0); // → A now in alternates[0]
    expect(d.forms[0].fields.username[0].selector).toBe("B");
    swapAlternateAt(d, 0, fieldSlot("username"), 0, 0); // → B back to alternates, A active
    expect(d.forms[0].fields.username[0].selector).toBe("A");
  });

  it("works for container and action slots", () => {
    const d = emptyDraft("example.com", "/login");
    // Container alternates are rare in normal flow (pickContainerCandidate sets
    // alternates: []); construct the state directly to exercise the swap.
    d.forms[0].container = [{ selector: "X", warnings: [], alternates: ["Y"] }];
    swapAlternateAt(d, 0, containerSlot(), 0, 0);
    expect(d.forms[0].container[0].selector).toBe("Y");

    addSelector(d, actionSlot("submit"), { selector: "A", warnings: [], alternates: ["B"] });
    swapAlternateAt(d, 0, actionSlot("submit"), 0, 0);
    expect(d.forms[0].actions.submit[0].selector).toBe("B");
  });
});

describe("removeSelectorAt", () => {
  it("deletes the field key when the last entry is removed", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, fieldSlot("username"), captured("input#one"));
    removeSelectorAt(d, 0, fieldSlot("username"), 0);
    expect(d.forms[0].fields.username).toBeUndefined();
  });

  it("keeps the field key when other entries remain", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, fieldSlot("username"), captured("input#one"));
    addSelector(d, fieldSlot("username"), captured("input#two"));
    removeSelectorAt(d, 0, fieldSlot("username"), 0);
    expect(d.forms[0].fields.username.length).toBe(1);
    expect(d.forms[0].fields.username[0].selector).toBe("input#two");
  });

  it("deletes the action key when emptied", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, actionSlot("submit"), captured("button#go"));
    removeSelectorAt(d, 0, actionSlot("submit"), 0);
    expect(d.forms[0].actions.submit).toBeUndefined();
  });
});

describe("form list", () => {
  it("addForm appends and activates the new form", () => {
    const d = emptyDraft("example.com", "/login");
    addForm(d);
    expect(d.forms.length).toBe(2);
    expect(d.activeFormIndex).toBe(1);
  });

  it("removeForm keeps at least one empty form and re-clamps the active index", () => {
    const d = emptyDraft("example.com", "/login");
    removeForm(d, 0);
    expect(d.forms.length).toBe(1);
    expect(d.activeFormIndex).toBe(0);
  });

  it("removeForm keeps the selected form selected when an earlier form is removed", () => {
    const d = emptyDraft("example.com", "/login");
    addForm(d);
    addForm(d);
    setCategory(d, 0, "login");
    setCategory(d, 1, "signup");
    setCategory(d, 2, "search");
    setActiveForm(d, 1);

    removeForm(d, 0);

    expect(d.forms.length).toBe(2);
    expect(d.forms[d.activeFormIndex].category).toBe("signup");
  });

  it("removeForm selects the following form when the selected form is removed", () => {
    const d = emptyDraft("example.com", "/login");
    addForm(d);
    setCategory(d, 0, "login");
    setCategory(d, 1, "signup");
    setActiveForm(d, 0);

    removeForm(d, 0);

    expect(d.forms.length).toBe(1);
    expect(d.forms[d.activeFormIndex].category).toBe("signup");
  });

  it("setActiveForm only accepts valid indices", () => {
    const d = emptyDraft("example.com", "/login");
    addForm(d);
    setActiveForm(d, 0);
    expect(d.activeFormIndex).toBe(0);
    setActiveForm(d, 99); // out of range, ignored
    expect(d.activeFormIndex).toBe(0);
  });

  it("toggleIrrelevant flips the flag", () => {
    const d = emptyDraft("example.com", "/login");
    toggleIrrelevant(d);
    expect(d.irrelevant).toBe(true);
    toggleIrrelevant(d);
    expect(d.irrelevant).toBe(false);
  });
});

describe("fieldSelectorsForActive", () => {
  it("returns the active form's flat field selectors", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, fieldSlot("username"), captured("a"));
    addSelector(d, fieldSlot("password"), captured("b"));
    addSelector(d, fieldSlot("username"), captured("a2"));
    expect(fieldSelectorsForActive(d).sort()).toEqual(["a", "a2", "b"]);
  });

  it("only includes string-shaped selectors", () => {
    const d = emptyDraft("example.com", "/login");
    d.forms[0].fields.username = [
      { selector: "x", warnings: [], alternates: [] },
      { selector: ["seq1", "seq2"], warnings: [], alternates: [] },
    ];
    expect(fieldSelectorsForActive(d)).toEqual(["x"]);
  });
});

describe("validateDraft", () => {
  it("returns no issues for a pristine draft", () => {
    expect(validateDraft(emptyDraft("example.com", "/login"))).toEqual([]);
  });

  it("requires a category for a non-pristine form", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, fieldSlot("username"), captured("input#x"));
    const issues = validateDraft(d);
    expect(issues.length).toBe(1);
    expect(issues[0]).toMatch(/category/);
  });

  it("requires fields when a category is set", () => {
    const d = emptyDraft("example.com", "/login");
    setCategory(d, 0, "account-login");
    const issues = validateDraft(d);
    expect(issues.length).toBe(1);
    expect(issues[0]).toMatch(/at least one field/);
  });

  it("skips pristine forms even when sibling forms have content", () => {
    const d = emptyDraft("example.com", "/login");
    setCategory(d, 0, "account-login");
    addSelector(d, fieldSlot("username"), captured("input#x"));
    addForm(d); // form 1 is pristine
    expect(validateDraft(d)).toEqual([]);
  });

  it("flags irrelevant + content as contradictory", () => {
    const d = emptyDraft("example.com", "/login");
    toggleIrrelevant(d);
    setCategory(d, 0, "account-login");
    const issues = validateDraft(d);
    expect(issues.length).toBe(1);
    expect(issues[0]).toMatch(/irrelevant/);
  });

  it("returns no issues for irrelevant + no content", () => {
    const d = emptyDraft("example.com", "/login");
    toggleIrrelevant(d);
    expect(validateDraft(d)).toEqual([]);
  });
});

describe("isDraftPristine", () => {
  it("is true for a freshly-created draft", () => {
    expect(isDraftPristine(emptyDraft("example.com", "/login"))).toBe(true);
  });

  it("is false once any content is captured", () => {
    const d = emptyDraft("example.com", "/login");
    addSelector(d, fieldSlot("username"), captured("input#x"));
    expect(isDraftPristine(d)).toBe(false);
  });

  it("is false for an intentionally-irrelevant draft (it maps the page to null)", () => {
    const d = emptyDraft("example.com", "/login");
    toggleIrrelevant(d);
    expect(isDraftPristine(d)).toBe(false);
  });
});

describe("toJsonc", () => {
  const parseExport = (draft: WebmapperDraft) => JSON.parse(toJsonc(draft));

  it("emits schemaVersion 1.0.0 and a single host entry", () => {
    const d = emptyDraft("example.com", "/login");
    setCategory(d, 0, "account-login");
    addSelector(d, fieldSlot("username"), captured("input#email"));
    const doc = parseExport(d);
    expect(doc.schemaVersion).toBe("1.0.0");
    expect(Object.keys(doc.hosts)).toEqual(["example.com"]);
  });

  it("puts forms under pathnames when a pathname is set", () => {
    const d = emptyDraft("example.com", "/login");
    setCategory(d, 0, "account-login");
    addSelector(d, fieldSlot("username"), captured("input#email"));
    expect(parseExport(d).hosts["example.com"]).toEqual({
      pathnames: {
        "/login": {
          forms: [{ category: "account-login", fields: { username: ["input#email"] } }],
        },
      },
    });
  });

  it("puts forms at host level when the pathname is null (host-wide)", () => {
    const d = emptyDraft("example.com", null);
    setCategory(d, 0, "account-login");
    addSelector(d, fieldSlot("username"), captured("input#email"));
    expect(parseExport(d).hosts["example.com"]).toEqual({
      forms: [{ category: "account-login", fields: { username: ["input#email"] } }],
    });
  });

  it("strips warnings and alternates (selector strings only in output)", () => {
    const d = emptyDraft("example.com", "/login");
    setCategory(d, 0, "account-login");
    addSelector(d, fieldSlot("username"), captured("input#email", ["w"], ["alt"]));
    const form = parseExport(d).hosts["example.com"].pathnames["/login"].forms[0];
    expect(form.fields.username).toEqual(["input#email"]);
  });

  it("includes container and actions when present", () => {
    const d = emptyDraft("example.com", "/login");
    setCategory(d, 0, "account-login");
    setPendingContainer(d, [candidate({ selector: "form#login" })]);
    pickContainerCandidate(d, 0, 0);
    addSelector(d, fieldSlot("username"), captured("input#email"));
    addSelector(d, actionSlot("submit"), captured("button[type='submit']"));
    const form = parseExport(d).hosts["example.com"].pathnames["/login"].forms[0];
    expect(form.container).toEqual(["form#login"]);
    expect(form.actions).toEqual({ submit: ["button[type='submit']"] });
  });

  it("drops forms missing category or fields", () => {
    const d = emptyDraft("example.com", "/login");
    // form 0 is pristine — gets dropped
    addForm(d);
    setCategory(d, 1, "account-login");
    addSelector(d, fieldSlot("username"), captured("input#email"));
    expect(parseExport(d).hosts["example.com"].pathnames["/login"].forms.length).toBe(1);
  });

  it("emits an irrelevant pathname as null", () => {
    const d = emptyDraft("example.com", "/login");
    toggleIrrelevant(d);
    expect(parseExport(d).hosts["example.com"]).toEqual({
      pathnames: { "/login": null },
    });
  });

  it("emits an irrelevant host-wide entry as null", () => {
    const d = emptyDraft("example.com", null);
    toggleIrrelevant(d);
    expect(parseExport(d).hosts["example.com"]).toBeNull();
  });

  it("emits a null host entry when there's nothing exportable", () => {
    const d = emptyDraft("example.com", "/login");
    expect(parseExport(d).hosts["example.com"]).toBeNull();
  });

  it("preserves the order of multiple forms", () => {
    const d = emptyDraft("example.com", "/login");
    setCategory(d, 0, "account-login");
    addSelector(d, fieldSlot("username"), captured("a"));
    addForm(d);
    setCategory(d, 1, "account-creation");
    addSelector(d, fieldSlot("username"), captured("b"));
    const forms = parseExport(d).hosts["example.com"].pathnames["/login"].forms;
    expect(forms[0].category).toBe("account-login");
    expect(forms[1].category).toBe("account-creation");
  });
});
