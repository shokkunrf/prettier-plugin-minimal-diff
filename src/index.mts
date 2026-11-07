// Prettier plugin that adds options for output with smaller diffs.
// It imports nothing from prettier at runtime, so any Prettier that loads it can run it.
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

type WrappedPrinter = Printer<Node> & { [WRAPPED]?: true };

type Options = ParserOptions<Node> & {
  markdownTableStyle?: "aligned" | "compact";
  // Set by Prettier before parsing; not part of its public types.
  printer?: WrappedPrinter;
};

type Print = Parameters<Printer<Node>["print"]>[2];

type ParserOrInit = Parser<Node> | (() => Parser<Node> | Promise<Parser<Node>>);

const NAME = "prettier-plugin-minimal-diff";
const WRAPPED = Symbol(NAME);

// Doc commands written as literals, since prettier/doc is not imported.
const hardline: Doc = [{ type: "line", hard: true }, { type: "break-parent" }];

// Same pragma checks as Prettier's Markdown parser, which this plugin cannot reach before parsing.
const FRONT_MATTER =
  /^(?<start>-{3}|\+{3})(?<language>[^\n]*)\n(?:|.*?\n)(?<end>\k<start>|\.{3})[^\S\n]*(?:\n|$)/s;
const pragmaPattern = (names: string) =>
  new RegExp(
    `<!--\\s*@(?:${names})\\s*-->|\\{\\s*\\/\\*\\s*@(?:${names})\\s*\\*\\/\\s*\\}|<!--.*\\r?\\n[\\s\\S]*(^|\\n)[^\\S\\n]*@(?:${names})[^\\S\\n]*($|\\n)[\\s\\S]*\\n.*-->`,
    "m",
  );
const PRAGMA = pragmaPattern("format|prettier");
const IGNORE_PRAGMA = pragmaPattern("noformat|noprettier");

function startsWithPragma(text: string, pattern: RegExp): boolean {
  return stripFrontMatter(text).trimStart().match(pattern)?.index === 0;
}

function stripFrontMatter(text: string): string {
  const match = text.match(FRONT_MATTER);
  if (!match?.groups) return text;
  const { start, language, end } = match.groups;
  const lang = start === "+++" ? "toml" : language.trim() || "yaml";
  if (lang !== "yaml" && start !== end) return text;
  return text.slice(match[0].length);
}

function createParser(name: string): Parser<Node> {
  const parser: Parser<Node> = {
    astFormat: "mdast",
    hasPragma: (text) => startsWithPragma(text, PRAGMA),
    hasIgnorePragma: (text) => startsWithPragma(text, IGNORE_PRAGMA),
    locStart: (node) => node.position.start.offset,
    locEnd: (node) => node.position.end.offset,
    async parse(text, options: Options) {
      const base = await findBaseParser(options, name, parser);
      const ast = await base.parse(text, options);
      if (options.markdownTableStyle === "compact") wrapPrinter(options);
      return ast;
    },
  };
  return parser;
}

// Delegate to the parser Prettier would use without this plugin: the last one loaded before it.
async function findBaseParser(
  options: Options,
  name: string,
  self: Parser<Node>,
): Promise<Parser<Node>> {
  // Prettier has loaded every plugin by the time it parses.
  const plugins = options.plugins as Array<{
    parsers?: Record<string, ParserOrInit>;
  }>;
  let base: ParserOrInit | undefined;
  for (const plugin of plugins) {
    const candidate = plugin.parsers?.[name];
    if (candidate === self) break;
    if (candidate) base = candidate;
  }
  if (!base) throw new Error(`${NAME}: no ${name} parser to wrap`);
  return typeof base === "function" ? base() : base;
}

// Swap in a printer for this format call only, so Prettier's own printer and its features stay in use.
function wrapPrinter(options: Options): void {
  const printer = options.printer;
  if (typeof printer?.print !== "function") {
    throw new Error(
      `${NAME}: unsupported Prettier version (no printer at parse time)`,
    );
  }
  if (printer[WRAPPED]) return;
  options.printer = {
    ...printer,
    [WRAPPED]: true,
    print(path, opts, print, args) {
      return path.node.type === "table"
        ? printCompactTable(path, print)
        : printer.print(path, opts, print, args);
    },
  };
}

function printCompactTable(path: AstPath<Node>, print: Print): Doc {
  const { node } = path;
  const rows: Doc[][] = path.map(
    (row) => row.map(() => print(), "children"),
    "children",
  );
  // One delimiter per header column; extra cells in body rows are not columns in GFM.
  const delimiters = rows[0].map((_, index) => {
    const align = node.align?.[index];
    const first = align === "left" || align === "center" ? ":" : "-";
    const last = align === "right" || align === "center" ? ":" : "-";
    return `${first}-${last}`;
  });
  return join(hardline, [
    printRow(rows[0]),
    `| ${delimiters.join(" | ")} |`,
    ...rows.slice(1).map(printRow),
  ]);
}

function printRow(cells: Doc[]): Doc {
  return ["| ", join(" | ", cells), " |"];
}

function join(separator: Doc, docs: Doc[]): Doc[] {
  return docs.flatMap((doc, index) => (index === 0 ? [doc] : [separator, doc]));
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
