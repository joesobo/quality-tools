const UPPERCASE_A = 'A'.charCodeAt(0);
const UPPERCASE_Z = 'Z'.charCodeAt(0);
const LOWERCASE_A = 'a'.charCodeAt(0);
const LOWERCASE_Z = 'z'.charCodeAt(0);
const DIGIT_ZERO = '0'.charCodeAt(0);
const DIGIT_NINE = '9'.charCodeAt(0);

export function isUppercaseLetter(character: string): boolean {
  const code = character.charCodeAt(0);
  return code >= UPPERCASE_A && code <= UPPERCASE_Z;
}

export function isLowercaseLetter(character: string): boolean {
  const code = character.charCodeAt(0);
  return code >= LOWERCASE_A && code <= LOWERCASE_Z;
}

export function isLetter(character: string): boolean {
  return isUppercaseLetter(character) || isLowercaseLetter(character);
}

export function isDigit(character: string): boolean {
  const code = character.charCodeAt(0);
  return code >= DIGIT_ZERO && code <= DIGIT_NINE;
}

export function isTokenCharacter(character: string): boolean {
  return isLetter(character) || isDigit(character);
}
