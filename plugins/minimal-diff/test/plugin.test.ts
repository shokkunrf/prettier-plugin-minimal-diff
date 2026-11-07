import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import * as markdown from "prettier/plugins/markdown";

import * as plugin from "../src/index.mts";

const pluginPath = fileURLToPath(new URL("../src/index.mts", import.meta.url));
const fixtures = new URL("fixtures/", import.meta.url);

const variants: prettier.Options[] = [
  {},
  { proseWrap: "always", printWidth: 20 },
  { proseWrap: "never", printWidth: 20 },
];

const read = (name: string) => readFile(new URL(name, fixtures), "utf8");

const format = (
  text: string,
  filepath: string,
  options: prettier.Options = {},
) => prettier.format(text, { filepath, plugins: [pluginPath], ...options });

const formatPlain = (
  text: string,
  filepath: string,
  options: prettier.Options = {},
) => prettier.format(text, { filepath, ...options });

const withoutTables = (text: string) =>
  text
    .split("\n")
    .filter((line) => !/^[\s>]*\|/.test(line))
    .join("\n");

const inputs = (await readdir(fixtures)).filter(
  (name) => !name.includes(".compact."),
);

for (const input of inputs) {
  const expected = input.replace(/\.(\w+)$/, ".compact.$1");

  test(`${input}: compact`, async () => {
    const actual = await format(await read(input), input, {
      markdownTableStyle: "compact",
    });
    assert.equal(actual, await read(expected));
  });

  test(`${input}: compact is idempotent`, async () => {
    const text = await read(expected);
    assert.equal(
      await format(text, input, { markdownTableStyle: "compact" }),
      text,
    );
  });

  for (const options of variants) {
    const label = JSON.stringify(options);

    test(`${input}: aligned matches Prettier ${label}`, async () => {
      const text = await read(input);
      assert.equal(
        await format(text, input, options),
        await formatPlain(text, input, options),
      );
    });

    test(`${input}: compact changes only tables ${label}`, async () => {
      const text = await read(input);
      const actual = await format(text, input, {
        ...options,
        markdownTableStyle: "compact",
      });
      assert.equal(
        withoutTables(actual),
        withoutTables(await formatPlain(text, input, options)),
      );
    });
  }
}

const pragmaSamples = [
  "# a\n",
  "<!-- @format -->\n\n# a\n",
  "<!-- @prettier -->\n# a\n",
  "\n\n  <!-- @format -->\n",
  "# a\n\n<!-- @format -->\n",
  "<!--\n  @format\n-->\n",
  "{/* @prettier */}\n",
  "---\ntitle: x\n---\n\n<!-- @format -->\n",
  "---\ntitle: x\n...\n<!-- @format -->\n",
  "+++\ntitle = 'x'\n+++\n<!-- @format -->\n",
  "---toml\ntitle = 'x'\n...\n<!-- @format -->\n",
  "<!-- @noformat -->\n",
  "<!-- @noprettier -->\n# a\n",
  "---\na: 1\n---\n<!-- @noformat -->\n",
];

test("pragma checks match Prettier's Markdown parsers", async () => {
  for (const [name, builtin] of Object.entries(markdown.parsers)) {
    const ours = plugin.parsers[name];
    assert.ok(ours, `parser ${name} is wrapped`);
    for (const text of pragmaSamples) {
      assert.equal(
        ours.hasPragma?.(text),
        builtin.hasPragma?.(text),
        `${name} hasPragma ${JSON.stringify(text)}`,
      );
      if (builtin.hasIgnorePragma) {
        assert.equal(
          ours.hasIgnorePragma?.(text),
          builtin.hasIgnorePragma(text),
          `${name} hasIgnorePragma ${JSON.stringify(text)}`,
        );
      }
    }
  }
});

test("requirePragma skips files without a pragma", async () => {
  const text = "| a | bb |\n|-|-|\n";
  const options = { requirePragma: true, markdownTableStyle: "compact" };
  assert.equal(await format(text, "a.md", options), text);
  assert.equal(
    await format(`<!-- @format -->\n\n${text}`, "a.md", options),
    "<!-- @format -->\n\n| a | bb |\n| --- | --- |\n",
  );
});

test("plugin can be passed as a module object", async () => {
  const actual = await prettier.format("| a | bb |\n|-|-|\n", {
    parser: "markdown",
    plugins: [plugin],
    markdownTableStyle: "compact",
  });
  assert.equal(actual, "| a | bb |\n| --- | --- |\n");
});

test("plugin path in a config file is relative to that file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "minimal-diff-"));
  try {
    await mkdir(join(dir, ".prettier"));
    await mkdir(join(dir, "docs"));
    await copyFile(pluginPath, join(dir, ".prettier", "minimal-diff.mts"));
    await writeFile(
      join(dir, ".prettierrc"),
      JSON.stringify({
        plugins: ["./.prettier/minimal-diff.mts"],
        markdownTableStyle: "compact",
      }),
    );
    const filepath = join(dir, "docs", "a.md");
    const config = await prettier.resolveConfig(filepath);
    const actual = await prettier.format("| a | bb |\n|-|-|\n", {
      ...config,
      filepath,
    });
    assert.equal(actual, "| a | bb |\n| --- | --- |\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
