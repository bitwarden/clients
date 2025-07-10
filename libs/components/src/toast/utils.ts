/**
 * Given a toast message, calculate the ideal timeout length following:
 * a minimum of 5 seconds + 1 extra second per 120 additional words
 *
 * @param message the toast message to be displayed
 * @returns the timeout length in milliseconds
 */
export const calculateToastTimeout = (message: string | string[]): number => {
  const paragraphs = Array.isArray(message) ? message : [message];
  const numWords = paragraphs
    .map((paragraph) => paragraph.split(/\s+/).filter((word) => word !== ""))
    .flat().length;
  return 5000 + Math.floor(numWords / 120) * 1000;
};
