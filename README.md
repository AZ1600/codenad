# Codenad

A browser-based Cloud/DevOps syntax trainer: spot an issue, understand why, review a suggested fix, apply it, and re-check. Practice ARM JSON, Kubernetes YAML, GitHub Actions YAML, and introductory Terraform/HCL, Bicep, Dockerfile, and Bash rules. General JavaScript, TypeScript, React, Python, JSON, HTML, and CSS checks remain available.

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

## Cloud/DevOps trainer

Start with ARM JSON and work through Kubernetes YAML, GitHub Actions YAML, Terraform/HCL, and Bicep. Dockerfile and Bash challenges are also available. General code modes remain available in the language picker.

The learning loop is: load a challenge (or paste your own configuration), check it, read why each issue matters, review one fix or all available fixes, apply, and inspect the automatic re-check. The review highlights changed lines. Undo restores the preceding code. Switching languages preserves the snippet and clears old diagnostics.

### Coverage

| Mode | Current checks |
| --- | --- |
| ARM JSON | JSON parsing; required template properties; resource collection shape; selected resource properties and misspellings |
| Kubernetes YAML | YAML parsing and duplicate keys; resource headers; selected Pod/Deployment container, replica, and selector checks; multiple documents |
| GitHub Actions YAML | YAML parsing; triggers, jobs, runners, steps, and reusable-workflow job structure |
| Terraform/HCL | Introductory resource/data block assignment rule only; not a full HCL parser |
| Bicep | Introductory single-line string delimiter rule only; not the Bicep compiler |
| Dockerfile | Selected instruction spelling checks, skipping continuations and simple heredocs |
| Bash | Possible spaced variable assignment; not a Bash parser |

No cloud credentials are needed. No infrastructure is deployed. Passing these checks does not establish deployment validity. Use the provider's validator/compiler and test in your own environment. Authoritative references are linked beside Cloud/DevOps diagnostics.
