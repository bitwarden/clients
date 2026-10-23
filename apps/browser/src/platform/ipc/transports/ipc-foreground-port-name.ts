// Name of the runtime port that extension pages open to the background for IPC.
export const IPC_FOREGROUND_PORT_NAME = "ipc-foreground-port";

/**
 * Name of the port the background opens once at startup to signal open extension pages to connect
 * an {@link IPC_FOREGROUND_PORT_NAME} port. It never carries IPC messages.
 */
export const IPC_FOREGROUND_WAKE_PORT_NAME = "ipc-foreground-wake-port";
