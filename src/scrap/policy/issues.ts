import * as ts from 'typescript';
import { parseIssues } from './parseIssues';
import { type ScrapValidationIssue } from '../model';
import { structureIssues } from './structureIssues';

export function validateScrapFile(sourceFile: ts.SourceFile): ScrapValidationIssue[] {
  return [...parseIssues(sourceFile), ...structureIssues(sourceFile)];
}
