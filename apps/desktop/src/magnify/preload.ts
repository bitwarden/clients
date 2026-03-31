import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("magnifyIpc", {
  sendCommand: (payload: object) => ipcRenderer.send("magnify.command", payload),
  onResults: (fn: (data: unknown) => void) =>
    ipcRenderer.on("magnify.results", (_, data) => fn(data)),
  platform: process.platform,
});
