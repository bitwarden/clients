// FORK (klappstuhl): preload for the standalone Quick Access spotlight window.
// Plain JS (no compilation) — copied verbatim to the build output by webpack's
// CopyWebpackPlugin. Exposes a tiny, locked-down bridge; the spotlight page has
// no Node access and never sees vault secrets.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kls", {
  search: (query) => ipcRenderer.send("kls-spotlight:search", query),
  onResults: (cb) => {
    const handler = (_event, items) => cb(items);
    ipcRenderer.on("kls-spotlight:results", handler);
    return () => ipcRenderer.removeListener("kls-spotlight:results", handler);
  },
  onReset: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("kls-spotlight:reset", handler);
    return () => ipcRenderer.removeListener("kls-spotlight:reset", handler);
  },
  activate: (id, action) => ipcRenderer.send("kls-spotlight:activate", { id, action }),
  close: () => ipcRenderer.send("kls-spotlight:close"),
  resize: (height) => ipcRenderer.send("kls-spotlight:resize", height),
});
