import test from 'node:test';
import assert from 'node:assert/strict';
import {correctCode} from './correct.js';
test('all available Python fixes are applied and rechecked',()=>{const result=correctCode('def total(items)\n    for item in items\n        print(item)\n','python');assert.equal(result.code,'def total(items):\n    for item in items:\n        print(item)\n');assert.deepEqual(result.issues,[]);});
test('partial correction retains unfixable diagnostics',()=>{const result=correctCode('var x = 1; console.lgo(x);','javascript');assert.equal(result.code,'var x = 1; console.log(x);');assert.equal(result.issues.length,1);});
test('already valid and empty code are unchanged',()=>{assert.equal(correctCode('const x = 1;','javascript').changed,false);assert.equal(correctCode('','python').code,'');});
