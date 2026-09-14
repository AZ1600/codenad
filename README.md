# Codenad

A browser-based code editor with syntax diagnostics and reviewable corrections for JavaScript, TypeScript, React JSX/TSX, Python, JSON, HTML, and CSS.

## Run locally

Requires Node.js, npm, and Python 3 (for the local static server).

```sh
npm ci
npm run build
npm run dev
```

Open http://localhost:5173. After editing source files, rebuild and refresh the browser.

## Deploy to Vercel

Import this GitHub repository into Vercel. The included `vercel.json` configures the Other framework preset, `npm ci`, `npm run build`, and the `dist` output directory. No environment variables are required.

## Checks

```sh
npm test
```

Code is analyzed in the browser and is not executed or sent to a code-analysis service. Diagnostics cover syntax and selected common mistakes, not all logic errors, runtime failures, or project-wide TypeScript type checking. Python uses grammar-based checks. Suggested changes are reviewed before applying; formatting is available for the supported languages except Python.

The `.openai/hosting.json` file records the original Sites registration and is not used by Vercel.
