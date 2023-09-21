(function () {
  chrome.runtime.sendMessage({ command: "triggerAutofillScriptInjection" });
})();
