// Name of the runtime port that extension pages open to the background for IPC.
export const IPC_FOREGROUND_PORT_NAME = "ipc-foreground-port";

/**
 * Command of the runtime message the background sends once at startup to ask open extension pages
 * to connect an {@link IPC_FOREGROUND_PORT_NAME} port.
 *
 * Extension pages must not listen to `runtime.onConnect`: a page listening there also receives
 * every other page's ports, which then stay open after the background stops.
 */
export const IPC_FOREGROUND_WAKE_COMMAND = "ipcForegroundWake";
