const MASTER_PASSWORD_INPUT_SELECTOR = 'input[formcontrolname="masterPassword"]';

/**
 * When a form submits, clears the DOM value of its filled master password input so the secret does
 * not stay in the field after it has been read.
 *
 * Only the DOM value is cleared. The Angular form control keeps its value because submit handlers
 * and post-login policy checks still read it. The input is focused before clearing, and left
 * focused, so the cleared value is applied to the active editing context. Keep the focus call.
 *
 * If the form is submitted again before the user types into the cleared field, an input event syncs
 * the form control with the empty field so the previous value is not submitted a second time.
 */
export function clearPasswordInputOnSubmit(doc: Document): void {
  // Inputs emptied by this listener whose form control still holds the previously submitted value.
  const clearedInputs = new WeakSet<HTMLInputElement>();

  doc.addEventListener(
    "input",
    (event) => {
      if (event.target instanceof HTMLInputElement) {
        clearedInputs.delete(event.target);
      }
    },
    { capture: true },
  );

  doc.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      for (const input of Array.from(
        form.querySelectorAll<HTMLInputElement>(MASTER_PASSWORD_INPUT_SELECTOR),
      )) {
        if (input.value !== "") {
          input.focus({ preventScroll: true });
          input.value = "";
          clearedInputs.add(input);
        } else if (clearedInputs.has(input)) {
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    },
    { capture: true },
  );
}
