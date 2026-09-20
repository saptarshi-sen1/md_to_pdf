# markdown-to-pdf

Convert any Markdown file into a single **A4 PDF** with every ` ```mermaid ` diagram
(flowchart / sequence / mindmap) **drawn** - not printed as code - and paginated with
`break-inside: avoid` so no diagram, code block or table is ever cut across pages.

Built once, reused everywhere. This repo is the **single source of truth**; projects
never carry their own copy. You consume it in one of four ways (all provided here):

| Way | Best for | No code copied |
|---|---|---|
| [1. Reusable workflow](#1-reusable-workflow-recommended-for-projects) | Any project's CI | ✅ - 1 small YAML file |
| [2. Composite action](#2-composite-action) | Custom jobs / multiple files | ✅ |
| [3. npm CLI](#3-npm-cli-global-install) | Your laptop - run from any folder | ✅ |
| [4. Docker image](#4-docker-ghcr) | Servers / scheduled jobs | ✅ |

GitHub repo: `saptarshi-sen1/md_to_pdf`  ·  npm package: `markdown-to-pdf`

## What's in this repo

| Item | Purpose |
|---|---|
| `build-pdf.js` | The converter: marked + highlight.js → headless Chromium → mermaid → `page.pdf()` |
| `style.css` | Print stylesheet (the "no-cut" pagination rules) |
| `action.yml` | GitHub composite action |
| `.github/workflows/build-pdf.yml` | Reusable workflow (`workflow_call`) |
| `.github/workflows/release.yml` | Publish npm + GHCR + release notes when you tag |
| `Dockerfile` | Container image |
| `examples/` | Ready-to-paste consumer YAMLs + `sample.md` for `npm test` |

## Local development / smoke test

```sh
npm ci
npm test          # builds examples/sample.pdf (3 diagrams)
node build-pdf.js myfile.md [out.pdf]
```

---

## 1. Reusable workflow (recommended for projects)

Put this in any project repo as `.github/workflows/build-pdf.yml`:

```yaml
name: Build PDF
on:
  push:
    branches: [main]
    paths: ['**.md']        # or a specific file like 'UiPath_Handbook.md'
  workflow_dispatch:

jobs:
  pdf:
    uses: saptarshi-sen1/md_to_pdf/.github/workflows/build-pdf.yml@v1
    with:
      input:  'UiPath_Handbook.md'   # relative to the caller repo
      output: 'UiPath_Handbook.pdf'  # optional; defaults to <input>.pdf
```

The implementation lives only here - versioned by tag (`@v1`). The PDF is uploaded
as an artifact, and on tag pushes it is attached to the project's release.

## 2. Composite action

```yaml
steps:
  - uses: actions/checkout@v4
  - name: Render markdown to PDF
    uses: saptarshi-sen1/md_to_pdf@v1
    with:
      input:  'docs/handbook.md'
      # output: 'out/handbook.pdf'   # optional
```

Use when you need to build several files or add your own steps around the build.

## 3. npm CLI (global install)

After publishing (`npm publish`), install once:

```sh
npm i -g markdown-to-pdf
markdown-to-pdf report.md            # -> report.pdf in the same folder
markdown-to-pdf a.md b.pdf           # explicit output
```

Works from **any folder** on any machine with Node 18+. For a project's CI you can
also use it via `npx markdown-to-pdf` after `npm i -D markdown-to-pdf`.

## 4. Docker (GHCR)

```sh
docker pull ghcr.io/saptarshi-sen1/md_to_pdf:latest
docker run --rm -v "$PWD:/work" ghcr.io/saptarshi-sen1/md_to_pdf:latest input.md [output.pdf]
```

Ideal for cron jobs / servers. There is also a local build option:
`docker build -t md-pdf . && docker run --rm -v "$PWD:/work" md-pdf input.md`.

---

## Publishing (already pushed - only tagging/publishing left)

The repo is already on GitHub (`saptarshi-sen1/md_to_pdf`, branch `main`). To make it
available to other repos via `@v1` and to the world via npm/GHCR:

1. Add an npm token so the release workflow can publish:
   npmjs.com → *Access Tokens* → generate → repo *Settings → Secrets and variables →
   Actions* → `NPM_TOKEN`.
2. Bump `version` in `package.json`, then:

   ```sh
   git tag v1.0.0 && git push origin v1.0.0
   git tag v1 && git push origin v1     # moving tag consumers lock onto
   ```

   The `Publish` workflow then: publishes to npm, pushes the Docker image to GHCR,
   and creates the GitHub Release.

> **Note:** the repo is created with `node_modules/` and `*.pdf` gitignored - nothing
> heavy is committed. Every machine installs deps fresh with `npm ci`.

## Troubleshooting

- The build prints `Diagrams: N total, N rendered`; if any diagram fails it prints a
  `WARNING` naming the source line - so a broken diagram is caught before you share.
- Missing Chromium? `npm ci` downloads it automatically (first run, ~170 MB).
- Intermediate HTML is written to `%TEMP%\handbook-pdf-debug.html` for inspection.