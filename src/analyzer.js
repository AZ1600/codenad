import {analyzeCloud, cloudLanguages, lessons} from './cloud.js';
import {parse} from '@babel/parser';
import {pythonLanguage} from '@codemirror/lang-python';
import {htmlLanguage} from '@codemirror/lang-html';
import {cssLanguage} from '@codemirror/lang-css';
export const samples={javascript:`// A small function. A few things to fix.\n\nfunction calculateTotal(items) {\n  let total = 0;\n\n  for (const item of items) {\n    total += item.price * item.quantity;\n  }\n\n  console.lgo("Your total:", total);\n  return total;\n}\n\nconst cart = [\n  { name: "Keyboard", price: 89, quantity: 1 },\n  { name: "Mouse", price: 45, quantity: 2 }\n];\n\ncalculateTotal(cart);`,typescript:`function greet(name: string): string {\n  console.lgo(name);\n  return "Hello, " + name;\n}\n\nconst message: string = greet("Alex");`,jsx:`export default function Welcome() {\n  return (\n    <section class="welcome">\n      <h1>Hello, builder.</h1>\n      <p>Make something great.</p>\n    </section>\n  );\n}`,tsx:`type Props = { name: string };\n\nexport default function Welcome({ name }: Props) {\n  return <h1 class="title">Hello, {name}</h1>;\n}`,python:`# Calculate the total for a shopping cart\n\ndef calculate_total(items)\n    total = 0\n    for item in items:\n        total += item["price"] * item["quantity"]\n    return total\n\ncart = [{"price": 89, "quantity": 2}]\nprint(calculate_total(cart))`,json:`{\n  "name": "Codenad",\n  "languages": ["JavaScript", "Python"],\n  "ready": true,\n}`,html:`<!doctype html>\n<html lang="en">\n  <head><title>Hello</title></head>\n  <body>\n    <h1>Hello, builder.</h1>\n    <p>Make something great.</p>\n  </body>\n</html>`,css:`.welcome {\n  color: #c4f58a;\n  background: #111315;\n  padding: 24px;\n}\n\n.welcome h1 {\n  font-size: 32px;\n}`};
function walk(node,visit){if(!node||typeof node!=='object')return; if(node.type)visit(node);for(const [key,value] of Object.entries(node)){if(['loc','errors','comments','tokens'].includes(key))continue;if(Array.isArray(value))value.forEach(v=>walk(v,visit));else if(value&&typeof value==='object')walk(value,visit);}}
export function analyze(code,language){
 if (cloudLanguages.includes(language)) return analyzeCloud(code, language);
 const issues=[];
 const add=(from,to,title,detail,severity='error',replacement)=>{from=Math.max(0,Math.min(code.length,from));to=Math.max(from,Math.min(code.length,to));issues.push({from,to,title,detail,severity,replacement,line:code.slice(0,from).split('\n').length});};
 if(!code.trim())return [];
 if(['javascript','typescript','jsx','tsx'].includes(language)){
  let ast;try{ast=parse(code,{sourceType:'unambiguous',errorRecovery:true,plugins:[...(['jsx','tsx'].includes(language)?['jsx']:[]),...(['typescript','tsx'].includes(language)?['typescript']:[])]});for(const e of ast.errors)add(e.pos,e.pos+1,e.message.replace(/ \(\d+:\d+\)$/,''),'Update the highlighted syntax, then check again.');}catch(e){add(e.pos??0,(e.pos??0)+1,e.message.replace(/ \(\d+:\d+\)$/,''),'The parser cannot continue here. Check this token and the line before it.');}
  if(ast)walk(ast,n=>{
   if(n.type==='MemberExpression'&&!n.computed&&n.object?.type==='Identifier'&&n.object.name==='console'&&['lgo','logg','lg','erorr','wanr'].includes(n.property?.name)){const fix={lgo:'log',logg:'log',lg:'log',erorr:'error',wanr:'warn'}[n.property.name];add(n.property.start,n.property.end,`Did you mean console.${fix}?`,`“${n.property.name}” looks like a misspelled console method. Review the suggested replacement.`,'warning',fix);}
   if(n.type==='JSXAttribute'&&n.name?.name==='class')add(n.name.start,n.name.end,'Use className in React','React uses className to assign CSS classes to an element.','warning','className');
   if(n.type==='JSXAttribute'&&n.name?.name==='for')add(n.name.start,n.name.end,'Use htmlFor in React','React labels use htmlFor to associate a label with an input.','warning','htmlFor');
   if(n.type==='VariableDeclaration'&&n.kind==='var')add(n.start,n.start+3,'Consider a block-scoped variable','Prefer let or const in modern code. Review the variable’s scope before changing it.','warning');
  });
 }else if(language==='json'){
  try{JSON.parse(code);}catch(e){const pos=Number(e.message.match(/position (\d+)/)?.[1]??0);add(pos,pos+1,'Invalid JSON',e.message);}
  let inString=false,escape=false;for(let i=0;i<code.length;i++){const c=code[i];if(inString){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')inString=false;}else if(c==='"')inString=true;else if(c===','&&/^\s*[}\]]/.test(code.slice(i+1))){add(i,i+1,'Remove the trailing comma','JSON does not allow a comma after the last property or array item.','error','');}}
 }else{
  const parser={python:pythonLanguage,html:htmlLanguage,css:cssLanguage}[language]?.parser;
  if(!parser)throw new Error('Unsupported language');
  const tree=parser.parse(code);tree.iterate({enter(n){if(n.type.isError)add(n.from,n.to||n.from,'Unexpected or missing syntax',language==='python'?'Check indentation, colons, and matching brackets near this position.':'Check the punctuation and structure near this position.');}});
  if(language==='python'){
   let offset=0;for(const line of code.split('\n')){const match=line.match(/^(\s*)(def\s+\w+\s*\([^#]*\)|(?:if|elif|for|while|with|class|except)\b[^#]*|else|try|finally)\s*(#.*)?$/);let context=tree.resolveInner(offset+line.search(/\S|$/),1);let inLiteral=false;while(context){if(/String|Comment/.test(context.name))inLiteral=true;context=context.parent;}if(match&&!inLiteral&&!match[2].trimEnd().endsWith(':')&&!/["']/.test(match[2])&&!/[\\]$/.test(match[2])){const end=offset+match[1].length+match[2].trimEnd().length;add(end,end,'Missing colon','Python block headers end with a colon.','error',':');}offset+=line.length+1;}
  }
 }
 const unique=issues.filter((v,i,a)=>a.findIndex(x=>x.from===v.from&&x.title===v.title)===i);
 return unique.sort((a,b)=>a.from-b.from);
}
export function applyFixes(code,issues){let next=code;const fixes=issues.filter(i=>i.replacement!==undefined).sort((a,b)=>b.from-a.from);let last=Infinity;for(const i of fixes){if(i.to>last)continue;next=next.slice(0,i.from)+i.replacement+next.slice(i.to);last=i.from;}return next;}

Object.assign(samples, Object.fromEntries(Object.entries(lessons).map(([key,lesson])=>[key,lesson.code])));
