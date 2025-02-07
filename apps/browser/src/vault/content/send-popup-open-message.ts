(function (globalContext) {
  // Send a message to the window that the popup opened
  globalContext.postMessage({ command: "popupOpened" });
})(window);
