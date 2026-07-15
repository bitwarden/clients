// Thrown by a transport's `send` when the target destination cannot be reached (e.g. the desktop
// app is not connected, or the web tab/document is gone). The sdk looks for this specific error.
export const DESTINATION_UNREACHABLE_ERROR = "Destination unreachable";
