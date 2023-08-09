export default class LockedVaultPendingNotificationsItem {
  commandToRetry: {
    msg: {
      command: string;
      data?: any;
    };
    sender: chrome.runtime.MessageSender;
  };
  target: string;
}
