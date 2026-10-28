/**
 * Single-action keys for popout windows the extension opens on the user's behalf during Send
 * flows.
 *
 * A popout carrying one of these keys was created *for* the user in response to a prompt, rather
 * than popped out *by* the user. That distinction matters when a flow finishes: a view may close
 * a popout the extension opened, but must leave one the user opened themselves alone.
 */
const SendPopoutType = {
  /**
   * The popout the file-picker guard opens for `/add-send`. File Sends cannot use the file picker
   * from inside the popup on affected browsers, so the Send menu prompts the user to pop out.
   */
  addFileSend: "send_AddFileSend",
} as const;

export { SendPopoutType };
