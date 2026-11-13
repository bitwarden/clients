/**
 * Default toast duration: 5 seconds plus 1 second per 120 words.
 */
export const calculateToastTimeout = (message: string | string[]): number => {
  const paragraphs = Array.isArray(message) ? message : [message];
  const numWords = paragraphs
    .map((paragraph) => paragraph.split(/\s+/).filter((word) => word !== ""))
    .flat().length;
  return 5000 + Math.floor(numWords / 120) * 1000;
};
