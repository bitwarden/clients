(function () {
  // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  chrome.runtime.sendMessage({ command: "triggerAutofillScriptInjection" });
})();
