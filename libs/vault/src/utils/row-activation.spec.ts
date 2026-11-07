import { isRowActivationClick } from "./row-activation";

describe("isRowActivationClick", () => {
  let cell: HTMLElement;

  beforeEach(() => {
    cell = document.createElement("div");
    document.body.appendChild(cell);
  });

  afterEach(() => {
    cell.remove();
    window.getSelection()?.removeAllRanges();
  });

  /** Dispatches a click on `target` and reports what the helper made of it. */
  function clickOn(target: Element, init: MouseEventInit = {}): boolean {
    let result: boolean | undefined;
    cell.addEventListener("click", (event) => (result = isRowActivationClick(event)), {
      once: true,
    });
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));
    return result!;
  }

  it("activates on a plain primary click on the cell", () => {
    expect(clickOn(cell)).toBe(true);
  });

  it("activates on a plain primary click on non-interactive content", () => {
    const text = document.createElement("span");
    text.textContent = "Engineering";
    cell.appendChild(text);

    expect(clickOn(text)).toBe(true);
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])("ignores %s clicks", (modifier) => {
    expect(clickOn(cell, { [modifier]: true })).toBe(false);
  });

  it("ignores non-primary buttons", () => {
    expect(clickOn(cell, { button: 1 })).toBe(false);
  });

  it.each([
    ['<a href="/folder">Name</a>', "a"],
    ["<button><span>Edit</span></button>", "span"],
    ["<input type='checkbox' />", "input"],
    ["<label>Select</label>", "label"],
    ["<select></select>", "select"],
    ["<textarea></textarea>", "textarea"],
    ["<div role='button'><i></i></div>", "i"],
    ["<div role='menuitem'>Delete</div>", "div"],
    ["<div role='checkbox'>Pick</div>", "div"],
  ])("leaves clicks inside %s to the element itself", (html, target) => {
    cell.innerHTML = html;

    expect(clickOn(cell.querySelector(target)!)).toBe(false);
  });

  it("activates on a click inside an anchor without an href", () => {
    cell.innerHTML = "<a>Name</a>";

    expect(clickOn(cell.querySelector("a")!)).toBe(true);
  });

  it("ignores a click that finishes a text selection", () => {
    cell.textContent = "Engineering";
    window.getSelection()!.selectAllChildren(cell);

    expect(clickOn(cell)).toBe(false);
  });

  it("activates when the only selected text is whitespace", () => {
    cell.textContent = "   ";
    window.getSelection()!.selectAllChildren(cell);

    expect(clickOn(cell)).toBe(true);
  });
});
