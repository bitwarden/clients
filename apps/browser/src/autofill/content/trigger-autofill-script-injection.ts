(function () {
  void chrome.runtime.sendMessage({ command: "triggerAutofillScriptInjection" });
})();
