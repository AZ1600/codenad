import {analyze, applyFixes} from './analyzer.js';

// Re-check between passes because one syntax fix may expose another diagnostic.
// Stop at a fixed bound and never report remaining issues as resolved.
export function correctCode(original, language) {
  let code = original;
  let issues = analyze(code, language);
  const seen = new Set([code]);
  let passes = 0;
  for (; passes < 8; passes++) {
    const next = applyFixes(code, issues);
    if (next === code || seen.has(next)) break;
    code = next;
    seen.add(code);
    issues = analyze(code, language);
    if (!issues.length) { passes++; break; }
  }
  return {code, issues, changed: code !== original, passes};
}
