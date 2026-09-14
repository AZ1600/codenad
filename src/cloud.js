import { parseAllDocuments, isMap, isSeq, isScalar } from 'yaml';
import { parseTree, findNodeAtLocation, getNodeValue, printParseErrorCode } from 'jsonc-parser';

export const cloudLanguages = ['arm', 'kubernetes', 'github-actions', 'terraform', 'bicep', 'dockerfile', 'bash'];
export const references = {
  arm: 'https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/syntax',
  kubernetes: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/',
  'github-actions': 'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax',
  terraform: 'https://developer.hashicorp.com/terraform/language/syntax/configuration',
  bicep: 'https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/file',
  dockerfile: 'https://docs.docker.com/reference/dockerfile/',
  bash: 'https://www.gnu.org/software/bash/manual/bash.html#Shell-Syntax',
};
export const scopes = {
  arm: 'JSON syntax and selected ARM template structure checks. Resource-provider schemas, expressions, and deployment validity are not evaluated.',
  kubernetes: 'YAML syntax, resource headers, and selected Deployment/Pod checks. No cluster validation, CRD schema checks, or Helm rendering.',
  'github-actions': 'YAML syntax and selected workflow/job/step checks. Expressions, action inputs, and runner availability are not evaluated.',
  terraform: 'Introductory HCL training rules only; not a full HCL parser. Run terraform fmt and terraform validate in your project for authoritative validation.',
  bicep: 'Introductory Bicep training rules only; not the Bicep compiler. Run bicep build for full syntax and type validation.',
  dockerfile: 'Selected Dockerfile instruction checks. Shell commands and advanced BuildKit syntax are not validated. Use docker build --check in your project.',
  bash: 'Selected Bash assignment checks only; not a shell parser. Use bash -n and ShellCheck for full syntax and lint checks.',
};
export const lessons = {
  arm: { title: 'Give an ARM template its required version', goal: 'Correct a misspelled contentVersion property without changing the deployment.', code: `{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVerison": "1.0.0.0",
  "resources": []
}` },
  kubernetes: { title: 'Use an integer replica count', goal: 'Find why this Deployment would reject its replica count.', code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: "2"
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.28
` },
  'github-actions': { title: 'Choose the runner with the correct key', goal: 'Find the job property that stops GitHub from selecting a runner.', code: `name: Check code
on: [push, pull_request]
jobs:
  check:
    runs_on: ubuntu-latest
    steps:
      - run: echo "Checking the project"
` },
  terraform: { title: 'Separate a block from an argument', goal: 'A resource block takes labels and a body, not an equals sign before its body.', code: `resource "terraform_data" "example" = {
  input = "Hello, infrastructure"
}
` },
  bicep: { title: 'Use Bicep string syntax', goal: 'Correct the string delimiter for this parameter default.', code: `param location string = "uksouth"

output deploymentLocation string = location
` },
  dockerfile: { title: 'Spell the build instruction correctly', goal: 'Find the instruction Docker cannot recognize.', code: `FROM node:22-alpine
WORKDIR /app
COYP package*.json ./
RUN npm ci
COPY . .
CMD ["node", "server.js"]
` },
  bash: { title: 'Assign a variable without spaces', goal: 'Bash treats words separated by spaces as command arguments, not an assignment.', code: `#!/usr/bin/env bash
APP_NAME = "codenad"
printf 'Deploying %s\\n' "$APP_NAME"
` },
};

export function analyzeCloud(code, language) {
  const issues = [];
  const add = (from, to, title, detail, replacement, severity = 'error', suggestion) => {
    from = Math.max(0, Math.min(code.length, from ?? 0));
    to = Math.max(from, Math.min(code.length, to ?? from));
    issues.push({ from, to, title, detail, replacement, severity, suggestion: suggestion ?? (replacement === undefined ? 'Review the highlighted value and correct it using the explanation.' : 'Review the proposed replacement before applying it.'), line: code.slice(0, from).split('\n').length, reference: references[language] });
  };
  if (!code.trim()) return issues;
  if (code.length > 100000) { add(0, 0, 'Snippet is too large', 'Use a snippet under 100,000 characters for responsive browser checks.'); return issues; }
  if (language === 'arm') {
    const errors = [];
    const root = parseTree(code, errors, { disallowComments: true, allowTrailingComma: false });
    for (const e of errors) add(e.offset, e.offset + e.length, 'Invalid JSON: ' + printParseErrorCode(e.error), 'ARM templates must first have valid JSON syntax. Correct punctuation before reviewing template structure.');
    if (errors.length || !root) return issues;
    const node = path => findNodeAtLocation(root, path);
    const report = (path, title, why, replacement, suggestion) => { const n = node(path) ?? root; add(n.offset, n.offset + n.length, title, why, replacement, 'error', suggestion); };
    if (root.type !== 'object') { report([], 'Template must be an object', 'An ARM deployment template is a JSON object, not an array or scalar.'); return issues; }
    const data = getNodeValue(root);
    function typo(path, wrong, right) { const parent = node(path); const prop = parent?.children?.find(p => p.children?.[0]?.value === wrong); if (!prop || node([...path, right])) return false; const key = prop.children[0]; add(key.offset, key.offset + key.length, `Use ${right}`, `ARM property names are case-sensitive. “${wrong}” is not the required “${right}” property.`, JSON.stringify(right)); return true; }
    const versionTypo = typo([], 'contentVerison', 'contentVersion');
    if (typeof data.$schema !== 'string') report(['$schema'], 'Declare the template schema', 'The $schema property identifies the ARM template schema and deployment scope.', undefined, 'Add a $schema URL appropriate to resource-group, subscription, management-group, or tenant scope.');
    if (!versionTypo && typeof data.contentVersion !== 'string') report(['contentVersion'], 'Declare contentVersion', 'ARM templates require a string contentVersion.', undefined, 'Add a version such as "contentVersion": "1.0.0.0".');
    else if (typeof data.contentVersion === 'string' && !/^\d+\.\d+\.\d+\.\d+$/.test(data.contentVersion)) report(['contentVersion'], 'Use a four-part content version', 'contentVersion uses four numeric components, such as 1.0.0.0.');
    const symbolic = data.languageVersion === '2.0';
    if (!(symbolic ? data.resources && typeof data.resources === 'object' && !Array.isArray(data.resources) : Array.isArray(data.resources))) report(['resources'], 'Declare the resources collection', symbolic ? 'ARM languageVersion 2.0 uses an object of symbolic resource names.' : 'This ARM template uses a resources array, including [] for an empty deployment.');
    if (data.resources && typeof data.resources === 'object') for (const key of Object.keys(data.resources)) {
      const path = ['resources', Array.isArray(data.resources) ? Number(key) : key]; const resource = data.resources[key];
      if (!resource || typeof resource !== 'object' || Array.isArray(resource)) { report(path, 'Resource must be an object', 'Each resource entry describes a resource with properties.'); continue; }
      const fixedApi = typo(path, 'apiVerison', 'apiVersion');
      for (const required of ['type', 'name', 'apiVersion']) if (!(required === 'apiVersion' && fixedApi) && typeof resource[required] !== 'string' && !(required === 'apiVersion' && typeof data.apiProfile === 'string')) report([...path, required], `Resource needs ${required}`, `Each resource needs a string ${required}; choose a value appropriate to that resource.`);
    }
  } else if (language === 'kubernetes' || language === 'github-actions') {
    let docs;
    try { docs = parseAllDocuments(code, { version: '1.2', uniqueKeys: true, keepSourceTokens: true }); } catch (e) { add(0, 0, 'YAML could not be parsed', e.message); return issues; }
    if (language === 'github-actions' && docs.length > 1) add(docs[1].range?.[0], docs[1].range?.[0], 'Use one workflow document', 'A GitHub Actions workflow file contains one YAML document. Put separate workflows in separate files.');
    for (const doc of docs) {
      for (const e of doc.errors) add(e.pos?.[0], e.pos?.[1], 'Invalid YAML', e.message);
      if (doc.errors.length) continue;
      const root = doc.contents;
      if (root === null && language === 'kubernetes') continue;
      const at = path => path.length ? doc.getIn(path, true) : root;
      const value = path => { const n = at(path); return isScalar(n) ? n.value : n; };
      const report = (path, title, why, replacement, severity = 'error', suggestion) => { const n = at(path) ?? root; add(n?.range?.[0] ?? 0, n?.range?.[1] ?? 0, title, why, replacement, severity, suggestion); };
      const typo = (path, wrong, right) => { const map = at(path); if (!isMap(map) || map.has(right)) return false; const pair = map.items.find(p => p.key?.value === wrong); if (!pair) return false; add(pair.key.range[0], pair.key.range[1], `Use ${right}`, `“${wrong}” is not the recognized key. Use “${right}” at this position.`, right); return true; };
      if (!isMap(root)) { report([], 'Expected a YAML mapping', 'Use key: value fields at the top level of this document.'); continue; }
      if (language === 'kubernetes') {
        const apiTypo = typo([], 'apiversion', 'apiVersion');
        for (const field of ['apiVersion', 'kind']) if (!(field === 'apiVersion' && apiTypo) && typeof value([field]) !== 'string') report([field], `Resource needs ${field}`, `Kubernetes needs a string ${field} to identify the API and resource kind.`);
        if (value(['kind']) === 'List') continue;
        if (!isMap(at(['metadata']))) report(['metadata'], 'Resource needs metadata', 'metadata identifies the Kubernetes object. Include a name or generateName.');
        else if (!value(['metadata', 'name']) && !value(['metadata', 'generateName'])) report(['metadata'], 'Give the object a name', 'A Kubernetes object needs metadata.name or metadata.generateName.');
        const kind = value(['kind']);
        if (kind === 'Deployment' && value(['apiVersion']) === 'apps/v1') {
          const replicas = at(['spec', 'replicas']);
          if (replicas && (!isScalar(replicas) || typeof replicas.value !== 'number' || !Number.isInteger(replicas.value) || replicas.value < 0)) {
            const fix = isScalar(replicas) && typeof replicas.value === 'string' && /^(0|[1-9]\d*)$/.test(replicas.value) && Number.isSafeInteger(Number(replicas.value)) ? replicas.value : undefined;
            report(['spec','replicas'], 'replicas must be a non-negative integer', 'Quoted YAML values are strings. Kubernetes expects an integer for the number of Pods.', fix);
          }
          const labels = at(['spec','selector','matchLabels']); const expressions = at(['spec','selector','matchExpressions']);
          if ((!isMap(labels) || !labels.items.length) && (!isSeq(expressions) || !expressions.items.length)) report(['spec','selector'], 'Deployment needs a non-empty selector', 'A Deployment uses matchLabels or matchExpressions to identify the Pods it manages.');
          if (isMap(labels)) for (const pair of labels.items) {
            if (!isScalar(pair.key) || !isScalar(pair.value)) continue;
            const key = pair.key.value; const desired = pair.value.value; const actual = value(['spec','template','metadata','labels',key]);
            if (desired !== actual) report(['spec','selector','matchLabels',key], 'Selector does not match the Pod template', `The selector’s ${key} value must agree with the Pod template label. Decide which label expresses the intended workload.`, undefined, 'error', 'Make spec.selector.matchLabels and spec.template.metadata.labels agree.');
          }
        }
        const podPath = kind === 'Pod' ? ['spec'] : kind === 'Deployment' && value(['apiVersion']) === 'apps/v1' ? ['spec','template','spec'] : null;
        if (podPath) { const containers = at([...podPath,'containers']); if (!isSeq(containers) || !containers.items.length) report([...podPath,'containers'], 'Define at least one container', 'A Pod spec needs a non-empty containers sequence.'); else containers.items.forEach((container, i) => { if (!isMap(container)) report([...podPath,'containers',i], 'Container must be a mapping', 'Each container is an object with a name and image.'); else for (const field of ['name','image']) if (typeof value([...podPath,'containers',i,field]) !== 'string') report([...podPath,'containers',i,field], `Container needs ${field}`, `Specify a string ${field} for this container.`); }); }
      } else {
        const trigger = at(['on']);
        if (!trigger || !((isScalar(trigger) && typeof trigger.value === 'string' && trigger.value.length) || (isMap(trigger) && trigger.items.length) || (isSeq(trigger) && trigger.items.length))) report(['on'], 'Define a workflow trigger', 'The on field names an event or event configuration that starts this workflow.');
        const jobs = at(['jobs']);
        if (!isMap(jobs) || !jobs.items.length) { report(['jobs'], 'Define at least one job', 'jobs must be a non-empty mapping of job identifiers to job definitions.'); continue; }
        for (const pair of jobs.items) {
          const id = pair.key?.value; const path = ['jobs', id];
          if (!isMap(pair.value)) { report(path, 'Job must be a mapping', 'Put the job configuration under its identifier.'); continue; }
          const job = pair.value; const runnerTypo = typo(path, 'runs_on', 'runs-on');
          if (job.has('uses')) { if (job.has('steps') || job.has('runs-on')) report(path, 'Reusable workflow jobs have no local steps or runner', 'A job calling a reusable workflow uses jobs.<id>.uses. The called workflow defines its own jobs and runners.'); continue; }
          if (!job.has('runs-on') && !runnerTypo) report(path, 'Choose a runner', 'A job containing steps needs runs-on to select where those steps execute.', undefined, 'error', 'Add runs-on with the intended hosted or self-hosted runner.');
          const steps = at([...path,'steps']);
          if (!isSeq(steps) || !steps.items.length) { report([...path,'steps'], 'Define job steps', 'A regular job needs a non-empty steps sequence.'); continue; }
          steps.items.forEach((step, i) => {
            const p = [...path,'steps',i]; if (!isMap(step)) { report(p, 'Step must be a mapping', 'Each step describes a command or an action.'); return; }
            const hasRun = step.has('run'), hasUses = step.has('uses');
            if (hasRun === hasUses) report(p, 'A step needs either run or uses', hasRun ? 'A single step cannot run a command and invoke an action. Split these into two steps.' : 'Use run for a shell command or uses for an action.');
            if (hasRun && typeof value([...p,'run']) !== 'string') report([...p,'run'], 'run must contain a command string', 'Write a command string or a YAML block scalar using |.');
            if (hasUses && typeof value([...p,'uses']) !== 'string') report([...p,'uses'], 'uses must name an action', 'An action reference must be a string.');
          });
        }
      }
    }
  } else {
    // Deliberately narrow training rules. These modes do not claim full parsing.
    let offset = 0, blockComment = false, multiline = false, heredoc = null, continued = false;
    for (const line of code.split('\n')) {
      const start = offset; offset += line.length + 1;
      if (heredoc) { if (line.trim() === heredoc) heredoc = null; continue; }
      if (multiline) { if (line.includes("'''")) multiline = false; continue; }
      if (blockComment) { if (line.includes('*/')) blockComment = false; continue; }
      if (/^\s*(#|\/\/)/.test(line)) continue;
      if (line.includes('/*')) { blockComment = !line.includes('*/', line.indexOf('/*') + 2); continue; }
      if (line.includes("'''")) { multiline = line.split("'''").length % 2 === 0; continue; }
      const here = line.match(/<<-?\s*['"]?([A-Za-z_][\w]*)['"]?/); if (here) { heredoc = here[1]; continue; }
      if (language === 'terraform') {
        const match = line.match(/^(\s*(?:resource|data)\s+"[^"\n]+"\s+"[^"\n]+"\s*)(=)(\s*\{)/);
        if (match) add(start + match[1].length, start + match[1].length + 1, 'A block header does not use =', 'In HCL, an argument uses name = value. A resource or data block uses its type, two labels, and a brace-delimited body.', '');
      } else if (language === 'bicep') {
        const match = line.match(/^(\s*(?:param\s+\w+\s+string|var\s+\w+|output\s+\w+\s+string)\s*=\s*)("[^"\\\r\n]*")\s*(?:\/\/.*)?$/);
        if (match) { const text = match[2].slice(1,-1); add(start + match[1].length, start + match[1].length + match[2].length, 'Bicep strings use single quotes', 'Bicep single-line string literals are enclosed in single quotes rather than JSON-style double quotes.', !text.includes("'") && !text.includes('${') ? `'${text}'` : undefined); }
      } else if (language === 'dockerfile') {
        if (continued) { continued = /[\\`]\s*$/.test(line); continue; }
        continued = /[\\`]\s*$/.test(line);
        const match = line.match(/^\s*([A-Za-z]+)\b/); if (!match) continue;
        const instruction = match[1].toUpperCase(); const known = ['FROM','RUN','CMD','LABEL','MAINTAINER','EXPOSE','ENV','ADD','COPY','ENTRYPOINT','VOLUME','USER','WORKDIR','ARG','ONBUILD','STOPSIGNAL','HEALTHCHECK','SHELL'];
        if (!known.includes(instruction)) { const fixed = {COYP:'COPY',FORM:'FROM',WOKRDIR:'WORKDIR',ENTRPOINT:'ENTRYPOINT'}[instruction]; const from = start + line.indexOf(match[1]); add(from, from + match[1].length, `Unknown Dockerfile instruction: ${match[1]}`, 'Dockerfile lines start with a recognized build instruction. This word is not an instruction.', fixed); }
      } else if (language === 'bash') {
        const match = line.match(/^(\s*)([A-Za-z_]\w*)(\s+=\s+)("[^"\\]*"|'[^']*'|[A-Za-z0-9_.\/-]+)\s*(?:#.*)?$/);
        if (match) { const from = start + match[1].length + match[2].length; add(from, from + match[3].length, 'Possible assignment with spaces', 'Bash interprets this as a command and arguments. If you intend to assign a variable, there must be no spaces around =.', '=', 'warning', 'If this is an assignment, replace the spaces and equals sign with =. Keep it unchanged if you intended to call a command.'); }
      }
    }
  }
  return issues.sort((a,b) => a.from - b.from);
}
