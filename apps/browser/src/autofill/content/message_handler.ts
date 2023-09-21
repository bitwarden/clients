window.addEventListener(
  "message",
  (event) => {
    if (event.source !== window) {
      return;
    }

    if (event.data.command && event.data.command === "authResult") {
      chrome.runtime.sendMessage({
        command: event.data.command,
        code: event.data.code,
        state: event.data.state,
        referrer: event.source.location.hostname,
      });
    }

    if (event.data.command && event.data.command === "webAuthnResult") {
      chrome.runtime.sendMessage({
        command: event.data.command,
        data: event.data.data,
        remember: event.data.remember,
        referrer: event.source.location.hostname,
      });
    }
  },
  false
);

const forwardCommands = [
  "promptForLogin",
  "passwordReprompt",
  "addToLockedVaultPendingNotifications",
  "unlockCompleted",
  "addedCipher",
  "openAddEditCipher",
];

chrome.runtime.onMessage.addListener((event) => {
  if (forwardCommands.includes(event.command)) {
    chrome.runtime.sendMessage(event);
  }
});
