import { execFile } from "child_process";
import * as path from "path";

import { BrowserWindow, globalShortcut, ipcMain } from "electron";

import { LogService } from "@bitwarden/logging";

import { WindowMain } from "./window.main";

/**
 * FORK (klappstuhl): Quick Access spotlight (1Password-style).
 *
 * A standalone, frameless, always-on-top window summoned by a global
 * Ctrl/Cmd+Shift+Space — WITHOUT opening the main app window. The spotlight is a
 * tiny static page (apps/desktop/src/spotlight/, copied to the build output by
 * webpack's CopyWebpackPlugin); it owns no vault data.
 *
 * Data flow (all decryption stays in the existing main-window renderer):
 *
 *   spotlight  --(kls-spotlight:search)-->  main  --(kls-qa:search)-->  renderer
 *   renderer   --(kls-qa:results)------->   main  --(kls-spotlight:results)--> spotlight
 *   spotlight  --(kls-spotlight:activate)-> main  --(kls-qa:activate)--> renderer (copies)
 *
 * Security: the spotlight only ever receives display fields (title/subtitle) and
 * sends back a cipher id + an action string. Passwords/TOTP are copied by the
 * renderer via the existing CopyBridgeService — secrets never enter this process
 * or the spotlight window.
 */
export class QuickAccessMain {
  private static readonly SHORTCUT = "CommandOrControl+Shift+Space";

  private spotlightWindow: BrowserWindow | null = null;
  private ipcRegistered = false;
  private labels: Record<string, string> | null = null;

  constructor(
    private readonly windowMain: WindowMain,
    private readonly logService: LogService,
  ) {}

  init(): void {
    this.registerIpc();

    if (globalShortcut.isRegistered(QuickAccessMain.SHORTCUT)) {
      return;
    }

    const registered = globalShortcut.register(QuickAccessMain.SHORTCUT, () => {
      this.toggle();
    });

    if (registered) {
      this.logService.info("Quick Access shortcut registered (Ctrl/Cmd+Shift+Space).");
    } else {
      this.logService.warning("Failed to register Quick Access shortcut.");
    }
  }

  dispose(): void {
    if (globalShortcut.isRegistered(QuickAccessMain.SHORTCUT)) {
      globalShortcut.unregister(QuickAccessMain.SHORTCUT);
    }
    if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
      this.spotlightWindow.destroy();
    }
    this.spotlightWindow = null;
  }

  private toggle(): void {
    const win = this.ensureWindow();
    if (win.isVisible()) {
      win.hide();
      return;
    }
    win.center();
    win.show();
    win.focus();
    // Push the latest translated labels, then reset the input/results.
    if (this.labels != null) {
      win.webContents.send("kls-spotlight:labels", this.labels);
    }
    win.webContents.send("kls-spotlight:reset");
    // Ask the renderer whether the vault is locked so the spotlight can offer to
    // unlock (e.g. Windows Hello) without opening the main window.
    this.mainWebContents?.send("kls-qa:lock-state-request");
    // Capture the app/page that was focused when the spotlight was summoned and
    // hand it to the renderer to surface context suggestions (empty-query state).
    void this.sendForegroundContext();
  }

  private ensureWindow(): BrowserWindow {
    if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
      return this.spotlightWindow;
    }

    const win = new BrowserWindow({
      width: 680,
      height: 96,
      frame: false,
      transparent: true,
      resizable: false,
      movable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      fullscreenable: false,
      minimizable: false,
      maximizable: false,
      // The panel draws its own rounded CSS shadow; a native window shadow on a
      // transparent window renders as an off-looking rectangle behind it.
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, "spotlight", "spotlight-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: false,
      },
    });

    win.setMenuBarVisibility(false);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Close on focus loss, like a native spotlight.
    win.on("blur", () => {
      if (win.isVisible()) {
        win.hide();
      }
    });
    win.on("closed", () => {
      this.spotlightWindow = null;
    });

    void win.loadFile(path.join(__dirname, "spotlight", "spotlight.html"));

    this.spotlightWindow = win;
    return win;
  }

  private get mainWebContents() {
    const win = this.windowMain.win;
    return win != null && !win.isDestroyed() ? win.webContents : null;
  }

  private registerIpc(): void {
    if (this.ipcRegistered) {
      return;
    }
    this.ipcRegistered = true;

    // Spotlight asks the renderer to search.
    ipcMain.on("kls-spotlight:search", (_event, query: string) => {
      this.mainWebContents?.send("kls-qa:search", query);
    });

    // Renderer returns results to the spotlight.
    ipcMain.on("kls-qa:results", (_event, items: unknown) => {
      if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
        this.spotlightWindow.webContents.send("kls-spotlight:results", items);
      }
    });

    // Spotlight asks which copyable fields an item has (for the submenu).
    ipcMain.on("kls-spotlight:actions-request", (_event, id: string) => {
      this.mainWebContents?.send("kls-qa:actions-request", id);
    });

    // Renderer returns the available actions to the spotlight.
    ipcMain.on("kls-qa:actions", (_event, payload: unknown) => {
      if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
        this.spotlightWindow.webContents.send("kls-spotlight:actions", payload);
      }
    });

    // Renderer pushes the translated label bundle; cache + forward to spotlight.
    ipcMain.on("kls-qa:labels", (_event, payload: Record<string, string>) => {
      this.labels = payload;
      if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
        this.spotlightWindow.webContents.send("kls-spotlight:labels", payload);
      }
    });

    // Spotlight activates an item; renderer performs the copy. Then close.
    ipcMain.on("kls-spotlight:activate", (_event, payload: { id: string; action: string }) => {
      this.mainWebContents?.send("kls-qa:activate", payload);
      if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
        this.spotlightWindow.hide();
      }
    });

    // Spotlight asks whether the vault is locked.
    ipcMain.on("kls-spotlight:lock-state-request", () => {
      this.mainWebContents?.send("kls-qa:lock-state-request");
    });

    // Renderer returns the lock state to the spotlight.
    ipcMain.on("kls-qa:lock-state", (_event, state: unknown) => {
      if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
        this.spotlightWindow.webContents.send("kls-spotlight:lock-state", state);
      }
    });

    // Spotlight asks the renderer to unlock with biometrics (no app window shown).
    ipcMain.on("kls-spotlight:unlock", () => {
      this.mainWebContents?.send("kls-qa:unlock");
    });

    // Renderer returns context suggestions; forward to the spotlight.
    ipcMain.on("kls-qa:suggestions", (_event, payload: unknown) => {
      if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
        this.spotlightWindow.webContents.send("kls-spotlight:suggestions", payload);
      }
    });

    // Spotlight requests close (Esc).
    ipcMain.on("kls-spotlight:close", () => {
      if (this.spotlightWindow != null && !this.spotlightWindow.isDestroyed()) {
        this.spotlightWindow.hide();
      }
    });

    // Spotlight grows/shrinks with its result list.
    ipcMain.on("kls-spotlight:resize", (_event, height: number) => {
      const win = this.spotlightWindow;
      if (win == null || win.isDestroyed()) {
        return;
      }
      const [width] = win.getSize();
      const clamped = Math.max(96, Math.min(584, Math.round(height)));
      win.setSize(width, clamped, false);
    });
  }

  /**
   * Read the title of the window that was in the foreground when the spotlight was
   * summoned, and push it to the renderer so it can suggest matching vault items.
   * Best-effort and non-blocking: failures (or non-Windows hosts) are ignored.
   */
  private async sendForegroundContext(): Promise<void> {
    const wc = this.mainWebContents;
    if (wc == null) {
      return;
    }
    try {
      const title = await this.foregroundWindowTitle();
      // Log only the length (never the title text — it can contain user data).
      this.logService.info(
        `[QuickAccess] foreground context captured (len=${title?.length ?? 0}).`,
      );
      if (title) {
        wc.send("kls-qa:context", title);
      }
    } catch {
      this.logService.info("[QuickAccess] foreground window capture failed (ignored).");
    }
  }

  /**
   * Returns the title of the topmost real window that isn't ours (Windows only).
   * Walks the Z-order from the foreground down — so it still finds the user's
   * window even though our spotlight is the one actually focused — and skips
   * windows owned by this process. Returns null on other platforms or on error.
   */
  private foregroundWindowTitle(): Promise<string | null> {
    if (process.platform !== "win32") {
      return Promise.resolve(null);
    }

    // GW_HWNDNEXT = 2. Add-Type compiles the P/Invoke shim on each call (cold), so
    // this resolves a few hundred ms after the panel is already on screen — fine
    // for a suggestion. Skips windows belonging to our own PID (main + spotlight).
    const script = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public struct KlsRect { public int Left; public int Top; public int Right; public int Bottom; }
public class KlsFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint c);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextLengthW(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out KlsRect r);
  [DllImport("user32.dll")] public static extern int GetWindowLongW(IntPtr h, int i);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
}
"@
$me = ${process.pid}
$h = [KlsFg]::GetForegroundWindow()
$n = 0
# Walk the Z-order from the foreground down. The chain is full of hidden helper
# windows and "always-on-top monitor" windows from background apps (Razer,
# NVIDIA, etc.), so filter to real, on-screen app windows: visible, not
# minimized, not ours, not a tool window, not DWM-cloaked, and big enough.
while ($h -ne [IntPtr]::Zero -and $n -lt 800) {
  $n++
  $ok = $true
  if (-not [KlsFg]::IsWindowVisible($h) -or [KlsFg]::IsIconic($h)) { $ok = $false }
  if ($ok) {
    $procId = 0
    [void][KlsFg]::GetWindowThreadProcessId($h, [ref]$procId)
    if ([int]$procId -eq $me) { $ok = $false }
  }
  if ($ok) {
    $ex = [KlsFg]::GetWindowLongW($h, -20)  # GWL_EXSTYLE
    if (($ex -band 0x80) -ne 0) { $ok = $false }  # WS_EX_TOOLWINDOW
  }
  if ($ok) {
    $cloaked = 0
    [void][KlsFg]::DwmGetWindowAttribute($h, 14, [ref]$cloaked, 4)  # DWMWA_CLOAKED
    if ($cloaked -ne 0) { $ok = $false }
  }
  if ($ok) {
    $r = New-Object KlsRect
    [void][KlsFg]::GetWindowRect($h, [ref]$r)
    if (($r.Right - $r.Left) -lt 200 -or ($r.Bottom - $r.Top) -lt 120) { $ok = $false }
  }
  if ($ok) {
    $len = [KlsFg]::GetWindowTextLengthW($h)
    if ($len -gt 0) {
      $sb = New-Object System.Text.StringBuilder ($len + 1)
      [void][KlsFg]::GetWindowTextW($h, $sb, $sb.Capacity)
      $t = $sb.ToString().Trim()
      if ($t.Length -gt 0) { Write-Output $t; break }
    }
  }
  $h = [KlsFg]::GetWindow($h, 2)
}`;

    // Pass the script as a base64 UTF-16LE -EncodedCommand: this avoids all the
    // quoting/newline ambiguity that a multi-line -Command (with an Add-Type
    // here-string) is prone to.
    const encoded = Buffer.from(script, "utf16le").toString("base64");

    return new Promise((resolve) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
        { timeout: 4000, windowsHide: true, maxBuffer: 1024 * 1024 },
        (error, stdout) => {
          if (error) {
            this.logService.info("[QuickAccess] powershell foreground probe errored (ignored).");
            resolve(null);
            return;
          }
          const title = (stdout || "").split(/\r?\n/)[0]?.trim() ?? "";
          resolve(title.length > 0 ? title : null);
        },
      );
    });
  }
}
