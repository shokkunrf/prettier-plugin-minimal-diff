# prettier-plugins

Prettier plugins, distributed from [GitHub Releases](https://github.com/shokkunrf/prettier-plugins/releases) rather than npm.

| Plugin | Description |
| --- | --- |
| [minimal-diff](plugins/minimal-diff) | Options for output with smaller diffs, starting with compact Markdown tables |

## Development

Each plugin lives in `plugins/<name>/` with its own `package.json` and tests.

```sh
cd plugins/<name>
npm ci
npm test
npm run typecheck
npm run build # Writes dist/index.mjs, the release file
npm run test:dist # Formats the test fixtures with dist/index.mjs
```

Tests load the TypeScript source directly. To test another Prettier version, run `npm install --no-save prettier@<version>` before `npm test`. Type checks expect the version in `package-lock.json`, and the minimal-diff tests need Prettier 3.6 or later.

This repository formats itself with minimal-diff (see `.prettierrc`). To check formatting, run `plugins/minimal-diff/node_modules/.bin/prettier --check .` from the repository root.

## License

[MIT](LICENSE)
