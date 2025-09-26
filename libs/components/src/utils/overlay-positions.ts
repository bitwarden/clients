import { ConnectedPosition } from "@angular/cdk/overlay";

const ORIGIN_OFFSET_PX = 14;
const OVERLAY_OFFSET_PX = 24;

export const ALLOWED_TOOLTIP_POSITION_IDS = [
  "left-center",
  "right-center",
  "above-center",
  "below-center",
] as const;

export const AllPositionIdentifiers = [
  "right-start",
  "right-center",
  "right-end",
  "left-start",
  "left-center",
  "left-end",
  "below-start",
  "below-center",
  "below-end",
  "above-start",
  "above-center",
  "above-end",
] as const;

export type PositionIdentifier = (typeof AllPositionIdentifiers)[number];

type ExtractedPositions<T extends readonly PositionIdentifier[] | undefined = undefined> =
  T extends readonly PositionIdentifier[] ? T[number] : PositionIdentifier;

export type AllowedTooltipPosition = ExtractedPositions<typeof ALLOWED_TOOLTIP_POSITION_IDS>;

export type DefaultPosition<Id extends PositionIdentifier = PositionIdentifier> =
  ConnectedPosition & {
    id: Id;
  };

type GetDefaultPositionConfig = {
  classNamePrefix?: string;
  originOffset?: number;
};

export function getDefaultPositions(options?: GetDefaultPositionConfig): DefaultPosition[];

/** With subset -> return is narrowed to that subset’s union */
export function getDefaultPositions<const T extends readonly PositionIdentifier[]>(
  options?: GetDefaultPositionConfig & { positionSubset: T },
): DefaultPosition<T[number]>[];

export function getDefaultPositions(
  options?: GetDefaultPositionConfig & { positionSubset?: readonly PositionIdentifier[] },
): DefaultPosition[] {
  const { classNamePrefix, originOffset, positionSubset } = options ?? {};

  const defaultPositions: DefaultPosition[] = [
    /**
     * The order of these positions matters. The Popover component will use
     * the first position that fits within the viewport.
     */

    // Popover opens to right of trigger
    {
      id: "right-start",
      offsetX: originOffset || ORIGIN_OFFSET_PX,
      offsetY: -OVERLAY_OFFSET_PX,
      originX: "end",
      originY: "center",
      overlayX: "start",
      overlayY: "top",
      panelClass: [`${classNamePrefix}-right`, `${classNamePrefix}-right-start`],
    },
    {
      id: "right-center",
      offsetX: originOffset || ORIGIN_OFFSET_PX,
      originX: "end",
      originY: "center",
      overlayX: "start",
      overlayY: "center",
      panelClass: [`${classNamePrefix}-right`, `${classNamePrefix}-right-center`],
    },
    {
      id: "right-end",
      offsetX: originOffset || ORIGIN_OFFSET_PX,
      offsetY: OVERLAY_OFFSET_PX,
      originX: "end",
      originY: "center",
      overlayX: "start",
      overlayY: "bottom",
      panelClass: [`${classNamePrefix}-right`, `${classNamePrefix}-right-end`],
    },
    // ... to left of trigger
    {
      id: "left-start",
      offsetX: originOffset ? -originOffset : ORIGIN_OFFSET_PX,
      offsetY: -OVERLAY_OFFSET_PX,
      originX: "start",
      originY: "center",
      overlayX: "end",
      overlayY: "top",
      panelClass: [`${classNamePrefix}-left`, `${classNamePrefix}-left-start`],
    },
    {
      id: "left-center",
      offsetX: originOffset ? -originOffset : ORIGIN_OFFSET_PX,
      originX: "start",
      originY: "center",
      overlayX: "end",
      overlayY: "center",
      panelClass: [`${classNamePrefix}-left`, `${classNamePrefix}-left-center`],
    },
    {
      id: "left-end",
      offsetX: originOffset ? -originOffset : ORIGIN_OFFSET_PX,
      offsetY: OVERLAY_OFFSET_PX,
      originX: "start",
      originY: "center",
      overlayX: "end",
      overlayY: "bottom",
      panelClass: [`${classNamePrefix}-left`, `${classNamePrefix}-left-end`],
    },
    // ... below trigger
    {
      id: "below-center",
      offsetY: originOffset || ORIGIN_OFFSET_PX,
      originX: "center",
      originY: "bottom",
      overlayX: "center",
      overlayY: "top",
      panelClass: [`${classNamePrefix}-below`, `${classNamePrefix}-below-center`],
    },
    {
      id: "below-start",
      offsetX: -OVERLAY_OFFSET_PX,
      offsetY: originOffset || ORIGIN_OFFSET_PX,
      originX: "center",
      originY: "bottom",
      overlayX: "start",
      overlayY: "top",
      panelClass: [`${classNamePrefix}-below`, `${classNamePrefix}-below-start`],
    },
    {
      id: "below-end",
      offsetX: OVERLAY_OFFSET_PX,
      offsetY: originOffset || ORIGIN_OFFSET_PX,
      originX: "center",
      originY: "bottom",
      overlayX: "end",
      overlayY: "top",
      panelClass: [`${classNamePrefix}-below`, `${classNamePrefix}-below-end`],
    },
    // ... above trigger
    {
      id: "above-center",
      offsetY: originOffset ? -originOffset : ORIGIN_OFFSET_PX,
      originX: "center",
      originY: "top",
      overlayX: "center",
      overlayY: "bottom",
      panelClass: [`${classNamePrefix}-above`, `${classNamePrefix}-above-center`],
    },
    {
      id: "above-start",
      offsetX: -OVERLAY_OFFSET_PX,
      offsetY: originOffset ? -originOffset : ORIGIN_OFFSET_PX,
      originX: "center",
      originY: "top",
      overlayX: "start",
      overlayY: "bottom",
      panelClass: [`${classNamePrefix}-above`, `${classNamePrefix}-above-start`],
    },
    {
      id: "above-end",
      offsetX: OVERLAY_OFFSET_PX,
      offsetY: originOffset ? -originOffset : ORIGIN_OFFSET_PX,
      originX: "center",
      originY: "top",
      overlayX: "end",
      overlayY: "bottom",
      panelClass: [`${classNamePrefix}-above`, `${classNamePrefix}-above-end`],
    },
  ];

  if (positionSubset?.length) {
    return defaultPositions.filter((position) => positionSubset.includes(position.id));
  }

  return defaultPositions;
}
