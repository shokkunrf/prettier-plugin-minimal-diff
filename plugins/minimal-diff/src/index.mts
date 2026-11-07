import type {
  AstPath,
  Doc,
  Parser,
  ParserOptions,
  Printer,
  SupportOptions,
} from "prettier";

interface Node {
  type: string;
  position: { start: { offset: number }; end: { offset: number } };
  align?: Array<"left" | "right" | "center" | null>;
  children?: Node[];
}

type Options = ParserOptions<Node> & {
  markdownTableStyle?: "aligned" | "compact";
  printer?: Printer<Node>; // Set by Prettier before parsing, but not in its types
};

type Print = Parameters<Printer<Node>["print"]>[2];

type LazyParser = Parser<Node> | (() => Parser<Node> | Promise<Parser<Node>>);

const hardline: Doc = [{ type: "line", hard: true }, { type: "break-parent" }];

const DELIMITERS: Record<string, string> = {
  left: ":--",
  right: "--:",
  center: ":-:",
};

// Up to the first closing delimiter, or "..." for YAML, as Prettier 3.3+ finds it
const FRONT_MATTER =
  /^(?:(---|\+\+\+)[\s\S]*?\n\1|---[^\S\n]*(?:yaml)?[^\S\n]*(?=\n)[\s\S]*?\n\.{3})/;

const FORMAT_PRAGMA = pragmaPattern("format|prettier");
const IGNORE_PRAGMA = pragmaPattern("noformat|noprettier");

function createParser(name: string): Parser<Node> {
  const parser: Parser<Node> = {
    astFormat: "mdast",
    hasPragma: (text) => startsWithPragma(text, FORMAT_PRAGMA),
    hasIgnorePragma: (text) => startsWithPragma(text, IGNORE_PRAGMA),
    locStart: (node) => node.position.start.offset,
    locEnd: (node) => node.position.end.offset,
    async parse(text, options: Options) {
      const previous = await findPreviousParser(options, name, parser);
      const ast = await previous.parse(text, options);
      if (options.markdownTableStyle === "compact") {
        compactTables(options);
      }
      return ast;
    },
  };
  return parser;
}

async function findPreviousParser(
  options: Options,
  name: string,
  self: Parser<Node>,
): Promise<Parser<Node>> {
  const plugins = options.plugins as Array<{
    parsers?: Record<string, LazyParser>;
  }>;
  const candidates = plugins.flatMap((plugin) => plugin.parsers?.[name] ?? []);
  const previous = candidates[candidates.lastIndexOf(self) - 1];
  if (typeof previous === "function") {
    return previous();
  }
  return previous;
}

function compactTables(options: Options): void {
  const printer = options.printer!;
  options.printer = {
    ...printer,
    print(path, opts, print, args) {
      if (path.node.type === "table") {
        return printTable(path, print, opts.parser);
      }
      return printer.print(path, opts, print, args);
    },
  };
}

function printTable(
  path: AstPath<Node>,
  print: Print,
  parser: Options["parser"],
): Doc {
  const rows: Doc[][] = path.map(
    (row) => row.map(() => print(), "children"),
    "children",
  );
  const columns = Math.max(...rows.map((row) => row.length));
  // Like Prettier, only mdx keeps delimiters past the header's cells
  const delimiters = Array.from(
    { length: columns },
    (_, index) => DELIMITERS[path.node.align?.[index] ?? ""] ?? "---",
  ).filter((_, index) => parser === "mdx" || index < rows[0].length);
  return join(hardline, [rows[0], delimiters, ...rows.slice(1)].map(printRow));
}

function printRow(cells: Doc[]): Doc {
  return ["| ", join(" | ", cells), " |"];
}

function join(separator: Doc, docs: Doc[]): Doc[] {
  return docs.flatMap((doc) => [separator, doc]).slice(1);
}

// Prettier checks pragmas before parsing, so this mirrors its Markdown check.
function startsWithPragma(text: string, pragma: RegExp): boolean {
  return text.replace(FRONT_MATTER, "").trimStart().match(pragma)?.index === 0;
}

function pragmaPattern(names: string): RegExp {
  return new RegExp(
    `<!--\\s*@(?:${names})\\s*-->|\\{\\s*\\/\\*\\s*@(?:${names})\\s*\\*\\/\\s*\\}|<!--.*\\r?\\n[\\s\\S]*(^|\\n)[^\\S\\n]*@(?:${names})[^\\S\\n]*($|\\n)[\\s\\S]*\\n.*-->`,
    "m",
  );
}

export const options: SupportOptions = {
  markdownTableStyle: {
    type: "choice",
    category: "Markdown",
    default: "aligned",
    description: "How to print Markdown tables.",
    choices: [
      {
        value: "aligned",
        description: "Pad cells so columns line up (Prettier default).",
      },
      { value: "compact", description: "Print tables at minimum width." },
    ],
  },
};

export const parsers: Record<string, Parser<Node>> = {
  markdown: createParser("markdown"),
  mdx: createParser("mdx"),
  remark: createParser("remark"),
};
