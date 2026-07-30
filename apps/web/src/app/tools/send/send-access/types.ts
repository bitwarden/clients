/** global contextual information for the current send access page. */
export type SendContext = {
  /** identifies the send */
  id: string;

  /** decrypts the send content */
  key: string;
};
