import { isDigit, isLetter, isLowercaseLetter, isUppercaseLetter } from './characters';

function isLowerToUpperBoundary(previous: string, current: string): boolean {
  return isLowercaseLetter(previous) && isUppercaseLetter(current);
}

function isLetterToDigitBoundary(previous: string, current: string): boolean {
  return isLetter(previous) && isDigit(current);
}

function isDigitToLetterBoundary(previous: string, current: string): boolean {
  return isDigit(previous) && isLetter(current);
}

function isAcronymBoundary(previous: string, current: string, next: string | undefined): boolean {
  if (next === undefined) {
    return false;
  }

  return isUppercaseLetter(previous) && isUppercaseLetter(current) && isLowercaseLetter(next);
}

export function shouldStartNewToken(previous: string, current: string, next: string | undefined): boolean {
  return isLowerToUpperBoundary(previous, current) ||
    isLetterToDigitBoundary(previous, current) ||
    isDigitToLetterBoundary(previous, current) ||
    isAcronymBoundary(previous, current, next);
}
