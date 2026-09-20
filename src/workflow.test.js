import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';
const bundle=buildSync({entryPoints:['src/app.js'],bundle:true,format:'iife',write:false}).outputFiles[0].text;
function setup(){
 const dom=new JSDOM(readFileSync('dist/index.html','utf8'),{runScripts:'outside-only',pretendToBeVisual:true,url:'http://localhost/'});
 const w=dom.window;w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
 w.Range.prototype.getClientRects=()=>[];w.Range.prototype.getBoundingClientRect=()=>({x:0,y:0,left:0,right:0,top:0,bottom:0,width:0,height:0});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 let tool;w.document.modelContext={registerTool(t){tool=t;}};w.eval(bundle);
 return {dom,w,d:w.document,tool};
}
test('ARM individual review applies, re-checks and can be undone',()=>{const {dom,d}=setup();try{
 d.querySelector('#analyze').click();assert.match(d.querySelector('#results').textContent,/Use contentVersion/);
 d.querySelector('[data-fix]').click();assert.equal(d.querySelector('#review').open,true);assert(d.querySelector('#corrected .changed-line'));
 d.querySelector('#apply').click();assert.equal(d.querySelector('#review').open,false);assert.match(d.querySelector('#results').textContent,/1 issue before, 0 remaining/);
 d.querySelector('#undo-fix').click();assert.match(d.querySelector('#results').textContent,/Use contentVersion/);
 }finally{dom.window.close();}});
test('language change preserves code, clears stale diagnostics, and loads selected challenge',()=>{const {dom,d,w}=setup();try{
 d.querySelector('#analyze').click();const old=d.querySelector('.cm-content').textContent;
 const select=d.querySelector('#language');select.value='kubernetes';select.dispatchEvent(new w.Event('change'));
 assert.equal(d.querySelector('.cm-content').textContent,old);assert.equal(d.querySelectorAll('.issue').length,0);
 d.querySelector('#sample').click();d.querySelector('#analyze').click();assert.match(d.querySelector('#results').textContent,/replicas must/);
 d.querySelector('[data-fix]').click();d.querySelector('#apply').click();assert.match(d.querySelector('#results').textContent,/0 remaining/);
 }finally{dom.window.close();}});
test('WebMCP shares UI state and rejects invalid input without changing it',()=>{const {dom,d,tool}=setup();try{
 assert.equal(tool.name,'check_code');const result=tool.execute({language:'bash',code:'NAME = value'});assert.equal(result.issues.length,1);assert.equal(d.querySelector('#language').value,'bash');
 const before=d.querySelector('.cm-content').textContent;assert.throws(()=>tool.execute({language:'unsupported',code:'text'}));assert.equal(d.querySelector('.cm-content').textContent,before);
 }finally{dom.window.close();}});
test('stale review cannot overwrite code supplied after review opened',()=>{const {dom,d,tool}=setup();try{
 d.querySelector('#analyze').click();d.querySelector('[data-fix]').click();tool.execute({language:'json',code:'{"new":true}'});d.querySelector('#apply').click();assert.match(d.querySelector('.cm-content').textContent,/new/);assert.equal(d.querySelector('#review').open,false);
 }finally{dom.window.close();}});
test('checking generates full corrected output and copies it without replacing original',async()=>{const {dom,d,w,tool}=setup();try{
 let copied;Object.defineProperty(w.navigator,'clipboard',{value:{async writeText(text){copied=text;}}});
 const source='console.lgo("hello");\nconsole.wanr("world");';
 tool.execute({language:'javascript',code:source});
 const expected='console.log("hello");\nconsole.warn("world");';
 assert.equal(d.querySelector('#corrected-code').value,expected);
 assert.match(d.querySelector('.cm-content').textContent,/console.lgo/);
 await d.querySelector('#copy-corrected').onclick();assert.equal(copied,expected);
 d.querySelector('#use-corrected').click();assert.match(d.querySelector('.cm-content').textContent,/console.log/);
 d.querySelector('#undo-fix').click();assert.match(d.querySelector('.cm-content').textContent,/console.lgo/);
 }finally{dom.window.close();}});
test('remaining errors are shown and output is cleared on language changes',()=>{const {dom,d,w,tool}=setup();try{
 tool.execute({language:'javascript',code:'const x = ;'});
 assert.match(d.querySelector('#corrected-status').textContent,/remain/);
 assert.match(d.querySelector('#output-remaining').textContent,/Unexpected/);
 const select=d.querySelector('#language');select.value='python';select.dispatchEvent(new w.Event('change'));
 assert.equal(d.querySelector('#corrected-output').hidden,true);assert.equal(d.querySelector('#corrected-code').value,'');
 tool.execute({language:'python',code:''});assert.equal(d.querySelector('#corrected-output').hidden,true);
 }finally{dom.window.close();}});
test('clipboard denial selects output for manual copying',async()=>{const {dom,d,w}=setup();try{
 Object.defineProperty(w.navigator,'clipboard',{value:{async writeText(){throw new Error('denied');}}});d.querySelector('#analyze').click();await d.querySelector('#copy-corrected').onclick();
 const field=d.querySelector('#corrected-code');assert.equal(field.selectionStart,0);assert.equal(field.selectionEnd,field.value.length);
 }finally{dom.window.close();}});
