/** The destination identity and URL used when collecting page details and filling a page. */
export interface FillTarget {
  /** Platform-assigned destination ID. Absent while the destination is unavailable. */
  id?: number;
  /** Current top-level URL, used for matching and checking collected page details. */
  url?: string;
}
