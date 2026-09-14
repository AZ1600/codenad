import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,applyFixes} from './analyzer.js';
import {cloudLanguages,lessons} from './cloud.js';
for (const language of cloudLanguages) test(`${language}: challenge → explanation → fix → clean re-check`,()=>{
  const code=lessons[language].code, issues=analyze(code,language);
  assert(issues.length>0);assert(issues.some(i=>i.replacement!==undefined));
  for(const i of issues){assert(i.detail);assert(i.suggestion);assert(i.reference.startsWith('https://'));assert(i.line>0);}
  const fixed=applyFixes(code,issues);assert.notEqual(code,fixed);assert.deepEqual(analyze(fixed,language),[]);
});
test('ARM distinguishes JSON syntax from template structure',()=>{assert(analyze('{"resources": [}', 'arm').some(i=>i.title.includes('JSON')));assert(analyze('[]','arm').some(i=>i.title.includes('object')));assert(analyze('{}','arm').some(i=>i.title.includes('resources')));});
test('ARM symbolic resources in languageVersion 2.0 are accepted',()=>{assert.deepEqual(analyze(JSON.stringify({$schema:'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',contentVersion:'1.0.0.0',languageVersion:'2.0',resources:{}}),'arm'),[]);});
test('ARM does not rename text in strings or overwrite a correct key',()=>{const code=lessons.arm.code.replace('"resources": []','"resources": [], "variables": {"text":"contentVerison"}');const fixed=applyFixes(code,analyze(code,'arm'));assert.equal(JSON.parse(fixed).variables.text,'contentVerison');});
test('YAML duplicate keys are parser errors',()=>{assert(analyze('on: push\non: pull_request\njobs: {}','github-actions').some(i=>i.title==='Invalid YAML'));});
test('YAML syntax handles multiline scripts without matching their contents',()=>{const code='on: push\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          echo runs_on: test\n          echo hello\n';assert.deepEqual(analyze(code,'github-actions'),[]);});
test('reusable workflow job needs no runs-on',()=>{assert.deepEqual(analyze('on: push\njobs:\n  shared:\n    uses: org/repo/.github/workflows/build.yml@main\n','github-actions'),[]);});
test('a step cannot combine run and uses',()=>{assert(analyze('on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo x\n        uses: ./action\n','github-actions').some(i=>i.title.includes('either run or uses')));});
test('Kubernetes handles multiple documents and reports document-local location',()=>{const fixed=applyFixes(lessons.kubernetes.code,analyze(lessons.kubernetes.code,'kubernetes'));const multi=fixed+'---\n'+lessons.kubernetes.code;const issues=analyze(multi,'kubernetes');assert.equal(issues.length,1);assert(issues[0].line>fixed.split('\n').length);assert.deepEqual(analyze(applyFixes(multi,issues),'kubernetes'),[]);});
test('Deployment selector mismatch needs a human decision',()=>{const fixed=applyFixes(lessons.kubernetes.code,analyze(lessons.kubernetes.code,'kubernetes')).replace('app: web','app: wrong');const issues=analyze(fixed,'kubernetes');assert(issues.some(i=>i.title.includes('Selector')&&i.replacement===undefined));});
test('do not replace YAML aliases with fixes spanning unrelated text',()=>{const code=lessons.kubernetes.code.replace('replicas: "2"','replicas: nope');assert(analyze(code,'kubernetes').some(i=>i.replacement===undefined));});
test('HCL resource strings and comments are untouched',()=>{assert.deepEqual(analyze('# resource "x" "y" = {\nresource "terraform_data" "x" {\n  input = { key: "valid object syntax" }\n}\n','terraform'),[]);});
test('Bicep apostrophes do not receive unsafe quote replacement',()=>{const issues=analyze('param title string = "Bob\'s app"','bicep');assert.equal(issues.length,1);assert.equal(issues[0].replacement,undefined);});
test('Docker heredoc commands are not treated as instructions',()=>{assert.deepEqual(analyze('FROM alpine\nRUN <<EOF\necho hello\nCOYP x y\nEOF\nCMD ["sh"]','dockerfile'),[]);});
test('Bash assignment fixes ignore comments and heredocs',()=>{assert.deepEqual(analyze('# APP = value\ncat <<EOF\nAPP = value\nEOF\nAPP=value\n','bash'),[]);});
