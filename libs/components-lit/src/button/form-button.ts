/**
 * Submits or resets the form a form-associated button belongs to. A shadow-root `<button>` can't
 * submit its host's form, and `requestSubmit()` only accepts native submitters, so a temporary
 * native button carries `name`/`value` and triggers implicit validation and submit events.
 */
export function activateFormButton(
  form: HTMLFormElement | null,
  type: "submit" | "reset" | "button",
  submitter?: { name?: string; value?: string },
) {
  if (!form || type === "button") {
    return;
  }
  if (type === "reset") {
    form.reset();
    return;
  }
  const proxy = document.createElement("button");
  proxy.type = "submit";
  proxy.hidden = true;
  if (submitter?.name) {
    proxy.name = submitter.name;
    proxy.value = submitter.value ?? "";
  }
  form.append(proxy);
  form.requestSubmit(proxy);
  proxy.remove();
}
