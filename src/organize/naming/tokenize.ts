import { stripExtension } from './stripExtension';
import { isTokenCharacter } from './characters';
import { shouldStartNewToken } from './boundaries';

/**
 * Split a name (filename or folder name) into lowercase tokens.
 *
 * Rules:
 * - Strip known file extensions first (.ts, .tsx, .js, .jsx, .test.ts, .test.tsx, .spec.ts, .spec.tsx)
 * - Split on camelCase boundaries
 * - Split on PascalCase boundaries
 * - Handle acronyms correctly
 * - Split on kebab-case, underscores, and dots
 * - Return all tokens in lowercase
 * - Filter out empty strings
 * - Keep single-character tokens
 */
export function tokenize(name: string): string[] {
  const withoutExtension = stripExtension(name);
  const characters = Array.from(withoutExtension);
  const tokens: string[] = [];
  let currentToken = '';

  characters.forEach((character, index) => {
    if (!isTokenCharacter(character)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken.toLowerCase());
        currentToken = '';
      }
      return;
    }

    const previous = currentToken[currentToken.length - 1] ?? '';
    if (shouldStartNewToken(previous, character, characters[index + 1])) {
      tokens.push(currentToken.toLowerCase());
      currentToken = character;
    } else {
      currentToken += character;
    }
  });

  if (currentToken.length > 0) {
    tokens.push(currentToken.toLowerCase());
  }

  return tokens;
}
