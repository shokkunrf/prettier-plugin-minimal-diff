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
```

Tests load the TypeScript source directly. To test another Prettier version, run `npm install --no-save prettier@<version>` before `npm test`.

This repository formats itself with minimal-diff (see `.prettierrc`). To check formatting, run `plugins/minimal-diff/node_modules/.bin/prettier --check .` from the repository root.

## Releasing

1. Bump `version` in `plugins/<name>/package.json`.
2. Create a GitHub release with the tag `<name>/v<version>`, such as `minimal-diff/v0.1.0`. The CD workflow tests the tag and uploads `<package>.mjs`, `<package>-<version>.tgz`, and `SHA256SUMS`.

## License

[MIT](LICENSE)
