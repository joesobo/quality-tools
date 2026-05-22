import * as ts from 'typescript';

export function parseSource(source: string): ts.SourceFile {
  return ts.createSourceFile('sample.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

export function findNodes(source: string, predicate: (node: ts.Node) => boolean): ts.Node[] {
  const nodes: ts.Node[] = [];

  function walk(node: ts.Node): void {
    if (predicate(node)) {
      nodes.push(node);
    }

    ts.forEachChild(node, walk);
  }

  walk(parseSource(source));
  return nodes;
}

export function firstNode(source: string, predicate: (node: ts.Node) => boolean): ts.Node {
  const [match] = findNodes(source, predicate);
  if (!match) {
    throw new Error('Expected fixture node to exist');
  }

  return match;
}

export function parseArrowFunction(source: string): ts.ArrowFunction {
  const sourceFile = parseSource(`const fn = ${source};`);
  const statement = sourceFile.statements[0] as ts.VariableStatement;
  const declaration = statement.declarationList.declarations[0];
  return declaration.initializer as ts.ArrowFunction;
}
