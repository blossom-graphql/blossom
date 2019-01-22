import { parse } from 'graphql';

export default function loader(source: string): string {
  const parsedResult = parse(source);

  return `export default ${JSON.stringify(parsedResult, null, 2)}`;
}
