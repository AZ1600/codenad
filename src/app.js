import {correctCode} from './correct.js';
import {EditorView, basicSetup} from 'codemirror';
import {EditorState, Compartment} from '@codemirror/state';
import {keymap} from '@codemirror/view';
import {StreamLanguage} from '@codemirror/language';
import {oneDark} from '@codemirror/theme-one-dark';
import {javascript} from '@codemirror/lang-javascript';
import {python} from '@codemirror/lang-python';
import {json} from '@codemirror/lang-json';
import {html} from '@codemirror/lang-html';
import {css} from '@codemirror/lang-css';
import {yaml} from '@codemirror/lang-yaml';
import {shell} from '@codemirror/legacy-modes/mode/shell';
import {dockerFile} from '@codemirror/legacy-modes/mode/dockerfile';
import {setDiagnostics} from '@codemirror/lint';
import {analyze, applyFixes, samples} from './analyzer.js';
import {cloudLanguages, lessons, scopes} from './cloud.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const modes = {arm:json, kubernetes:yaml, 'github-actions':yaml, terraform:()=>[], bicep:()=>[], dockerfile:()=>StreamLanguage.define(dockerFile), bash:()=>StreamLanguage.define(shell), javascript:()=>javascript(), typescript:()=>javascript({typescript:true}), jsx:()=>javascript({jsx:true}), tsx:()=>javascript({jsx:true,typescript:true}), python, json, html, css};
const filenames = {arm:'azuredeploy.json', kubernetes:'deployment.yaml', 'github-actions':'workflow.yaml', terraform:'main.tf', bicep:'main.bicep', dockerfile:'Dockerfile', bash:'deploy.sh', javascript:'playground.js', typescript:'playground.ts', jsx:'component.jsx', tsx:'component.tsx', python:'playground.py', json:'data.json', html:'index.html', css:'style.css'};
const formatParsers = {arm:'json', kubernetes:'yaml', 'github-actions':'yaml', javascript:'babel', typescript:'typescript', jsx:'babel', tsx:'typescript', json:'json', html:'html', css:'css'};
let lang = 'arm', issues = [], checked = false, previous = null, pending = null, revision = 0, toastTimer, diagnosticTimer, recheck = '', challengeActive = true;
const languageCompartment = new Compartment();
const editor = new EditorView({state:EditorState.create({doc:samples[lang], extensions:[basicSetup, oneDark, languageCompartment.of(modes[lang]()), EditorView.theme({'&':{backgroundColor:'#17191c'}, '.cm-gutters':{backgroundColor:'#17191c'}}), EditorView.contentAttributes.of({'aria-label':'Code editor', spellcheck:'false'}), keymap.of([{key:'Mod-Enter',run:()=>{performCheck();return true;}}]), EditorView.updateListener.of(update => {
  if (update.docChanged) {
    revision++; checked = false; issues = []; recheck = ''; clearTimeout(diagnosticTimer); showUnChecked();
    diagnosticTimer = setTimeout(()=>{if (!checked) editor.dispatch(setDiagnostics(editor.state, []));},0);
  }
  const line = update.state.doc.lineAt(update.state.selection.main.head);
  $('#cursor').textContent = `Ln ${line.number}, Col ${update.state.selection.main.head-line.from+1}`;
  $('#line-count').textContent = `${update.state.doc.lines} lines`;
})]}), parent:$('#editor')});
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('#toast').classList.remove('visible'),3500); }
function updateLanguageLabels() { $('#language').value = lang; $('#filename').textContent = filenames[lang]; $('#file-icon').textContent = ({arm:'ARM',kubernetes:'K8', 'github-actions':'CI',terraform:'TF',bicep:'B',dockerfile:'D',bash:'SH'})[lang] ?? lang.toUpperCase(); $('#sample').textContent = cloudLanguages.includes(lang) ? '↻ Load challenge' : '↻ Load example'; renderLesson(); }
function renderLesson() { const lesson = lessons[lang]; $('#lesson').hidden = !lesson; if (lesson) $('#lesson').innerHTML = `<strong>${esc(challengeActive ? lesson.title : 'Your configuration')}</strong><span class="lesson-status">${challengeActive ? (checked && !issues.length ? 'Challenge checks passed' : 'Practice challenge') : 'Free practice'}</span><p>${esc(challengeActive ? lesson.goal : 'Check your own configuration using the rules available for this format.')}</p>`; }
function showUnChecked() { $('#corrected-output').hidden = true; $('#corrected-code').value = '';  $('#insight-status').textContent = 'Not checked'; $('#results').classList.remove('has-results'); $('#results').innerHTML = '<div class="empty-icon">⌕</div><h2>Spot the issue first.</h2><p>Read the configuration, then check it to reveal explanations and suggested fixes.</p>'; renderLesson(); }
function scope() { return scopes[lang] ?? (lang === 'python' ? 'Python grammar checks; no runtime or import validation.' : ['typescript','tsx'].includes(lang) ? 'Syntax and selected common mistakes; project-wide type checking is not included.' : 'Syntax and selected common mistakes; runtime behavior is not checked.'); }
function replaceCode(code) { editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:code}}); }
function switchLanguage(next) { lang = next; revision++; checked = false; issues = []; recheck = ''; previous = null; challengeActive = false; editor.dispatch({effects:languageCompartment.reconfigure(modes[lang]())}); editor.dispatch(setDiagnostics(editor.state, [])); updateLanguageLabels(); showUnChecked(); }
function performCheck() {
  try {
    const code = editor.state.doc.toString();
    if (code.length > 100000) throw new Error('Use a snippet under 100,000 characters.');
    clearTimeout(diagnosticTimer); issues = analyze(code, lang); checked = true;
    $('#insight-status').textContent = issues.some(i=>i.suggestedLanguage) ? 'Check language' : !code.trim() ? 'Empty' : issues.length ? `${issues.length} found` : 'Checks passed';
    editor.dispatch(setDiagnostics(editor.state, issues.map(i=>({from:i.from,to:i.to,severity:i.severity,message:i.title}))));
    renderResults(); renderCorrectedOutput(); renderLesson(); return issues;
  } catch(error) { $('#corrected-output').hidden = true; $('#corrected-code').value = ''; checked=false; $('#insight-status').textContent='Check failed'; $('#results').textContent=error.message; throw error; }
}
function safeCheck() { try { performCheck(); } catch(error) { toast(error.message); } }
function renderResults() {
  const code = editor.state.doc.toString(), errors = issues.filter(i=>i.severity==='error').length, fixable = issues.filter(i=>i.replacement!==undefined).length;
  const panel = $('#results'); panel.classList.add('has-results');
  if (!code.trim()) { panel.innerHTML='<h2>Your workspace is empty.</h2><p>Paste a configuration or load a challenge.</p>'; return; }
  panel.innerHTML = recheck ? `<div class="recheck-summary" role="status">${esc(recheck)}</div>` : '';
  if (issues.length) panel.innerHTML += `<div class="result-summary"><span class="error-count">${errors} errors / ${issues.length-errors} suggestions</span><span>${fixable} fixable</span></div>` + issues.map((i,k)=>`<article class="issue ${i.severity}"><div class="issue-top"><span>${i.severity==='error'?'⊗ ERROR':'◇ SUGGESTION'}</span><button class="quiet" data-line="${k}" aria-label="Go to line ${i.line}">LINE ${i.line} ↗</button></div><h3>${esc(i.title)}</h3><h4>Why it matters</h4><p>${esc(i.detail)}</p><h4>Suggested fix</h4><p>${esc(i.suggestion ?? (i.replacement!==undefined ? 'Review this replacement and apply it if it matches your intent.' : 'Correct this in the editor, then check again.'))}</p>${i.replacement!==undefined ? `<code>${esc(code.slice(i.from,i.to)||'(insert)')} → ${esc(i.replacement||'(remove)')}</code>` : ''}<div class="issue-controls">${i.suggestedLanguage?`<button class="primary" data-language-fix="${k}">Switch to Python &amp; check</button>`:''}${i.replacement!==undefined?`<button class="secondary" data-fix="${k}">Review this fix</button>`:''}${i.reference?`<a href="${esc(i.reference)}" target="_blank" rel="noopener noreferrer">Official reference ↗</a>`:''}</div></article>`).join('');
  else panel.innerHTML += '<div class="success-icon">✓</div><h2>No issues found by these checks.</h2><p>Review the coverage below before using this configuration in a real project.</p>';
  panel.innerHTML += `<div class="result-actions">${fixable>1?'<button class="primary" id="review-all">Review all fixes</button>':''}<button class="secondary" id="copy-code">Copy code</button>${formatParsers[lang]?'<button class="secondary" id="format-code">Format</button>':''}${previous?'<button class="secondary" id="undo-fix">Undo last change</button>':''}</div><p class="scope-note">${esc(scope())}</p>`;
  panel.querySelectorAll('[data-line]').forEach(button=>button.onclick=()=>{const i=issues[Number(button.dataset.line)];editor.dispatch({selection:{anchor:i.from},scrollIntoView:true});editor.focus();});
  panel.querySelectorAll('[data-fix]').forEach(button=>button.onclick=()=>reviewFixes([issues[Number(button.dataset.fix)]]));
  panel.querySelectorAll('[data-language-fix]').forEach(button=>button.onclick=()=>{const next=issues[Number(button.dataset.languageFix)].suggestedLanguage; switchLanguage(next);safeCheck();});
  $('#review-all')?.addEventListener('click',()=>reviewFixes(issues));
  $('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(editor.state.doc.toString());toast('Code copied');}catch{toast('Select your code and copy it manually; the clipboard is unavailable.');}};
  $('#format-code')?.addEventListener('click',formatCode);
  $('#undo-fix')?.addEventListener('click',()=>{const old=previous;previous=null;replaceCode(old.code);recheck='Last change undone. Checks ran again.';safeCheck();});
}
function renderCorrectedOutput() {
  const original = editor.state.doc.toString();
  if (!original.trim() || issues.some(i=>i.suggestedLanguage)) { $('#corrected-output').hidden = true; $('#corrected-code').value = ''; return; }
  const result = correctCode(original, lang);
  const outputRevision = revision;
  $('#corrected-output').hidden = false;
  $('#corrected-code').value = result.code;
  $('#corrected-status').textContent = result.issues.length
    ? `${result.changed ? 'Available fixes applied.' : 'No automatic fixes available.'} ${result.issues.length} issue${result.issues.length===1?'':'s'} remain in this output and need review.`
    : `${result.changed ? 'Available fixes applied and re-checked.' : 'No changes needed.'} No issues found by the available checks.`;
  $('#output-remaining').innerHTML = result.issues.length ? '<h3>Still needs attention</h3><ul>' + result.issues.map(i=>`<li><strong>Line ${i.line}: ${esc(i.title)}</strong><br>${esc(i.detail)}</li>`).join('') + '</ul>' : '';
  $('#copy-corrected').onclick = async () => {
    if (outputRevision !== revision || !checked) { toast('Code changed. Check again for fresh output.'); return; }
    try { await navigator.clipboard.writeText(result.code); toast('Corrected output copied'); }
    catch { const field=$('#corrected-code'); field.focus(); field.select(); toast('Output selected. Press Ctrl+C or ⌘C to copy.'); }
  };
  $('#use-corrected').disabled = !result.changed;
  $('#use-corrected').onclick = () => {
    if (outputRevision !== revision || !checked) { toast('Code changed. Check again for fresh output.'); return; }
    previous = {code:original}; replaceCode(result.code); safeCheck(); toast('Corrected output moved to editor and re-checked');
  };
}
function reviewFixes(selected) { showReview(applyFixes(editor.state.doc.toString(),selected), 'Review the highlighted changes. Applying them re-checks the configuration automatically.'); }
function showReview(code, description) {
  pending={code,original:editor.state.doc.toString(),language:lang,revision,before:issues.length};
  const before=pending.original.split('\n'), after=code.split('\n');
  $('#original').innerHTML=before.map((line,i)=>`<span class="${line===after[i]?'same-line':'changed-line'}">${esc(line)||' '}</span>`).join('');
  $('#corrected').innerHTML=after.map((line,i)=>`<span class="${line===before[i]?'same-line':'changed-line'}">${esc(line)||' '}</span>`).join('');
  $('#review-description').textContent=description; $('#review').showModal();
}
async function formatCode() {
  const before=editor.state.doc.toString(), beforeRevision=revision, beforeLang=lang, button=$('#format-code'); button.disabled=true; button.textContent='Formatting…';
  try {
    const [prettier,babel,estree,typescript,htmlPlugin,postcss,yamlPlugin]=await Promise.all([import('prettier/standalone'),import('prettier/plugins/babel'),import('prettier/plugins/estree'),import('prettier/plugins/typescript'),import('prettier/plugins/html'),import('prettier/plugins/postcss'),import('prettier/plugins/yaml')]);
    const result=await prettier.format(before,{parser:formatParsers[beforeLang],plugins:[babel,estree,typescript,htmlPlugin,postcss,yamlPlugin],tabWidth:2});
    if (beforeRevision!==revision) { toast('Code or language changed. Format the current version again.'); return; }
    if (result===before) toast('Formatting is already consistent'); else showReview(result,'Review the formatting changes. Applying them also runs the checks again.');
  } catch { toast('Resolve syntax errors before formatting.'); } finally { button.disabled=false;button.textContent='Format'; }
}
$('#analyze').onclick=safeCheck;
$('#language').onchange=event=>switchLanguage(event.target.value);
$('#sample').onclick=()=>{previous={code:editor.state.doc.toString()};challengeActive=true;replaceCode(samples[lang]);renderLesson();toast(cloudLanguages.includes(lang)?'Challenge loaded. Try spotting the issue before checking.':'Example loaded');};
$('#apply').onclick=()=>{
  if (!pending || pending.revision!==revision || pending.language!==lang) { toast('Code or language changed. Review a fresh fix.'); $('#review').close(); return; }
  const snapshot=pending; previous={code:snapshot.original};replaceCode(snapshot.code);$('#review').close();pending=null;
  try { performCheck();recheck=`Re-checked: ${snapshot.before} issue${snapshot.before===1?'':'s'} before, ${issues.length} remaining.${issues.length?' Review the remaining feedback.':' Available checks passed.'}`;renderResults();toast('Changes applied and re-checked'); } catch(error) { toast('Changes applied, but re-check failed: '+error.message); }
};
$('#close-review').onclick=$('#cancel-review').onclick=()=>$('#review').close();
$('#review').addEventListener('close',()=>{pending=null;});
updateLanguageLabels();showUnChecked();$('#line-count').textContent=`${editor.state.doc.lines} lines`;
if (document.modelContext?.registerTool) {
  const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  try { Promise.resolve(document.modelContext.registerTool({name:'check_code',description:'Replace the visible snippet and check the specified format. No code is executed or deployed.',inputSchema:{type:'object',properties:{code:{type:'string',maxLength:100000},language:{type:'string',enum:Object.keys(modes)}},required:['code','language'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(!input||typeof input.code!=='string'||input.code.length>100000||!Object.hasOwn(modes,input.language))throw new Error('Provide a supported language and code under 100,000 characters.');switchLanguage(input.language);replaceCode(input.code);return {language:lang,coverage:scope(),issues:performCheck().map(({line,title,detail,severity,suggestion})=>({line,title,detail,severity,suggestion}))};}},{signal:lifecycle.signal})).catch(()=>{}); } catch {}
}
