export function portName(storageLocation: chrome.storage.StorageArea) {
  switch (storageLocation) {
    case chrome.storage.local:
      return "local";
    case chrome.storage.sync:
      return "sync";
    case chrome.storage.session:
      return "session";
    default:
      throw new Error("Unknown storage location");
  }
}
