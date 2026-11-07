# prettier-plugin-minimal-diff

A Prettier plugin that adds options for output with smaller diffs.

## Options

### `markdownTableStyle`

| Value                 | Output                                           |
| --------------------- | ------------------------------------------------ |
| `"aligned"` (default) | Pads cells so columns line up, as Prettier does. |
| `"compact"`           | Prints each table at minimum width.              |

Prettier pads every cell so columns line up, so editing one cell can re-pad the whole table. With `"compact"`, editing a cell changes only its row:

<!-- prettier-ignore-start -->
```md
| Option | Type | Default |
| :-- | --: | :-: |
| `packages` | string | `""` |
```
<!-- prettier-ignore-end -->

- Only tables change. Prose wrapping, `printWidth`, code blocks, and front matter are formatted as usual.
- Applies to the `markdown`, `mdx`, and `remark` parsers, including tables in lists, blockquotes, and `md` code blocks that Prettier formats as Markdown.
- Delimiter rows use `---`, `:--`, `--:`, or `:-:`, one per header column.
- Tables after `<!-- prettier-ignore -->` are kept as is.

## Installation

The plugin is distributed from [GitHub Releases](https://github.com/shokkunrf/prettier-plugin-minimal-diff/releases), not from npm. Prettier cannot load plugins from `https://` URLs, so either download the file or install the package tarball.

### Single file

Works without `package.json`, for example with a globally installed Prettier.

```sh
mkdir -p .prettier
curl -fsSL -o .prettier/minimal-diff.mjs \
  https://github.com/shokkunrf/prettier-plugin-minimal-diff/releases/download/v0.1.0/prettier-plugin-minimal-diff.mjs
```

```json
{
  "plugins": ["./.prettier/minimal-diff.mjs"],
  "markdownTableStyle": "compact"
}
```

Relative plugin paths in a config file are resolved from that file. Each release also has `SHA256SUMS` for checking the download.

### npm package

```sh
npm install --save-dev https://github.com/shokkunrf/prettier-plugin-minimal-diff/releases/download/v0.1.0/prettier-plugin-minimal-diff-0.1.0.tgz
```

```json
{
  "plugins": ["prettier-plugin-minimal-diff"],
  "markdownTableStyle": "compact"
}
```

## Supported Prettier versions

Prettier 3.0.0 and later. CI tests the oldest supported version, the last patch of each 3.x minor, and `latest` and `next`, also weekly.

The plugin does not import `prettier`, so it runs on whichever Prettier loads it, including a global install or one bundled with an editor extension.

## How it works

- Wraps the `markdown`, `mdx`, and `remark` parsers of the Prettier that loads it, and keeps that Prettier's printer.
- With `"compact"`, it replaces `options.printer` at parse time with a copy that prints `table` nodes from their printed cells. Everything else goes to Prettier's own printer.
- Prettier does not document that `options.printer` is set before parsing. If it is missing, the plugin throws rather than printing aligned tables; the weekly CI run against new Prettier releases is there to catch other changes.

## Development

```sh
npm ci
npm test               # Builds dist/index.mjs and tests it
npm run typecheck
npm run format:check
```

To test another Prettier version, build first, since the build uses the pinned Prettier's types:

```sh
npm run build
npm install --no-save prettier@<version>
npm run test:run
```

## Releasing

1. Bump `version` in `package.json`.
2. Create a GitHub release with the tag `v<version>`. The CD workflow tests the tag and uploads `prettier-plugin-minimal-diff.mjs`, `prettier-plugin-minimal-diff-<version>.tgz`, and `SHA256SUMS`.

## Alternatives

- [@dvyio/prettier-plugin-collapse-markdown-tables](https://www.npmjs.com/package/@dvyio/prettier-plugin-collapse-markdown-tables) prints similar tables (`:---` where this plugin prints `:--`). It rewrites Prettier's printed text and imports `prettier` as a peer dependency.
- [prettier-plugin-compact-markdown-table](https://www.npmjs.com/package/prettier-plugin-compact-markdown-table) prints `|a|b|` and `|-|-|` without spaces around cells.

## License

[MIT](LICENSE)
