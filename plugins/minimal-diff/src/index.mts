import type {
  AstPath,
  Doc,
  Parser,
  ParserOptions,
  Printer,
  SupportOptions,
} from "prettier";

const NAME = "prettier-plugin-minimal-diff";

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

function createParser(name: string): Parser<Node> {
  const parser: Parser<Node> = {
    astFormat: "mdast",
    locStart: (node) => node.position.start.offset,
    locEnd: (node) => node.position.end.offset,
    async parse(text, options: Options) {
      const previous = await findPreviousParser(options, name, parser);
      const ast = await previous.parse(text, options);
      if (options.markdownTableStyle === "compact") compactTables(options);
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
  let previous: LazyParser | undefined;
  for (const plugin of options.plugins as Array<{
    parsers?: Record<string, LazyParser>;
  }>) {
    const candidate = plugin.parsers?.[name];
    if (candidate === self) break;
    previous = candidate ?? previous;
  }
  if (!previous) throw new Error(`${NAME}: no ${name} parser to wrap`);
  return typeof previous === "function" ? previous() : previous;
}

function compactTables(options: Options): void {
  const { printer } = options;
  if (!printer) throw new Error(`${NAME}: no printer set before parsing`);
  options.printer = {
    ...printer,
    print: (path, opts, print, args) =>
      path.node.type === "table"
        ? printTable(path, print)
        : printer.print(path, opts, print, args),
  };
}

function printTable(path: AstPath<Node>, print: Print): Doc {
  const rows: Doc[][] = path.map(
    (row) => row.map(() => print(), "children"),
    "children",
  );
  const delimiters = rows[0].map(
    (_, index) => DELIMITERS[path.node.align?.[index] ?? ""] ?? "---",
  );
  return join(hardline, [rows[0], delimiters, ...rows.slice(1)].map(printRow));
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
