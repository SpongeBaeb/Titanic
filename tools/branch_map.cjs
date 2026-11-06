/* 분기 지도 생성기
 *   실행: node tools/branch_map.cjs   (C:\Titanic 에서)
 *   결과: 분기_지도.md
 *
 * 장면 정의(scenes.ts)와 문항(questions.ts), 밤 장면(demoScenes.ts)을 실제로 불러와서,
 * 선택지를 하나씩 바꿔 가며 "무엇이 달라지는지"를 직접 시험해 표로 만든다.
 * 코드를 바꾼 뒤 이 스크립트를 다시 돌리면 지도도 새로 만들어진다.
 *
 * 한계: 한 번에 하나의 값만 바꿔 보므로 "두 선택이 함께일 때만 달라지는" 규칙은 따로 잡히지 않는다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'frontend', 'src');
const ts = require(path.join(ROOT, 'frontend', 'node_modules', 'typescript'));

// ── 간이 모듈 로더: TS 를 CommonJS 로 바꿔 불러온다 ──
const cache = new Map();
function resolveFile(from, spec) {
  const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : path.resolve(path.dirname(from), spec);
  for (const c of [base + '.ts', base + '.tsx', path.join(base, 'index.ts')]) if (fs.existsSync(c)) return c;
  throw new Error('찾을 수 없음: ' + spec + ' (from ' + from + ')');
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod);
  new Function('exports', 'require', 'module', code)(mod.exports, (spec) => load(resolveFile(file, spec)), mod);
  return mod.exports;
}

const { scenes, sceneIds, CHAPTERS, PROLOGUE, RESULT } = load(path.join(SRC, 'engine', 'scenes.ts'));
const { questionsData } = load(path.join(SRC, 'data', 'questions.ts'));
const { demoScenes } = load(path.join(SRC, 'engine', 'demoScenes.ts'));

// ── 성향 점수표에 쓰이는 선택 (traits.ts 의 TABLE 을 글자로 읽는다) ──
const traitsSrc = fs.readFileSync(path.join(SRC, 'engine', 'traits.ts'), 'utf8');
const tableBlock = traitsSrc.slice(traitsSrc.indexOf('const TABLE'), traitsSrc.indexOf('export interface TraitType'));
const scored = {};
let cur = null;
for (const line of tableBlock.split('\n')) {
  const m = line.match(/^ {2}([A-Za-z0-9]+): \{/);
  if (m) { cur = m[1]; scored[cur] = []; continue; }
  const o = line.match(/^ {4}([A-Za-z0-9_]+): \[/);
  if (o && cur) scored[cur].push(o[1]);
}

// ── 기본 맥락과 변형 만들기 ──
const baseCtx = () => ({ answers: {}, flags: {}, picks: [], run: 1, extras: {} });
const cineOf = (s) => (s.cine ? demoScenes.find((c) => c.id === s.cine) : undefined);

function optionsOf(id, ctx) {
  const s = scenes[id];
  const cine = s && cineOf(s);
  if (cine) {
    const opts = typeof cine.options === 'function' ? cine.options(ctx) : cine.options;
    return opts.map((o) => ({ key: o.id, label: o.label, sets: o.sets ? Object.keys(o.sets) : [] }));
  }
  const q = questionsData[id];
  return q ? q.options.map((o) => ({ key: o.value, label: o.label, sets: [] })) : [];
}

// 시험해 볼 선택값: 문항이 있는 장면의 answerKey → 선택지 값들
const answerValues = {};
for (const id of sceneIds) {
  const s = scenes[id];
  if (s.answerKey && questionsData[id]) answerValues[s.answerKey] = questionsData[id].options.map((o) => o.value);
}
// 선택지 목록에는 없지만 코드가 따로 다루는 숨은 값 (이스터에그 등). 새로 만들면 여기에 적는다.
const HIDDEN_VALUES = { companion: ['dog'] };
for (const [k, vals] of Object.entries(HIDDEN_VALUES)) answerValues[k] = [...(answerValues[k] ?? []), ...vals];
// 밤 장면이 남기는 상태값(flags)
const flagNames = new Set();
for (const c of demoScenes) {
  for (const run of [1, 2]) {
    const opts = typeof c.options === 'function' ? c.options({ ...baseCtx(), run }) : c.options;
    for (const o of opts) Object.keys(o.sets ?? {}).forEach((f) => flagNames.add(f));
  }
}

function variations() {
  const out = [];
  for (const [k, vals] of Object.entries(answerValues)) for (const v of vals) out.push({ label: `${k}=${v}`, ctx: { ...baseCtx(), answers: { [k]: v } } });
  for (const f of flagNames) out.push({ label: `flag:${f}`, ctx: { ...baseCtx(), flags: { [f]: true } } });
  out.push({ label: 'run=2 (두 번째 항해)', ctx: { ...baseCtx(), run: 2 } });
  out.push({ label: 'night=1 (밤 장면 경로)', ctx: { ...baseCtx(), extras: { night: true } } });
  return out;
}
const VARS = variations();

const short = (t, n = 60) => (typeof t === 'string' ? ((t = t.replace(/\s+/g, ' ')).length > n ? t.slice(0, n) + '…' : t) : JSON.stringify(t));
const json = (x) => JSON.stringify(x ?? null);

// ── 장면별 분석 ──
const rows = [];
for (const id of sceneIds) {
  const s = scenes[id];
  const cine = cineOf(s);
  const q = questionsData[id];
  const base = baseCtx();
  const defaultNext = typeof s.next === 'function' ? s.next(base) : s.next;

  // 다음 장면이 달라지는 조건
  const nextDiffs = [];
  if (typeof s.next === 'function') {
    for (const v of VARS) {
      let r;
      try { r = s.next(v.ctx); } catch { continue; }
      if (r !== defaultNext) nextDiffs.push(`${v.label} → ${r}`);
    }
  }

  // 같은 장면의 내용이 달라지는 조건(제목·부제·선택지 구성·이야기)
  const contentDiffs = [];
  const baseVar = s.variant ? json(s.variant({ ...base, answers: base.answers })) : '';
  const baseOpts = json(optionsOf(id, base).map((o) => o.key));
  const baseStory = cine && typeof cine.story === 'function' ? json(cine.story({ ...base, elapsed: 0 })) : '';
  for (const v of VARS) {
    const notes = [];
    try {
      if (s.variant) {
        const r = s.variant(v.ctx);
        if (json(r) !== baseVar) {
          const b = s.variant(base) ?? {};
          const fields = [];
          if ((r?.title ?? null) !== (b.title ?? null)) fields.push('제목');
          if ((r?.subtitle ?? null) !== (b.subtitle ?? null)) fields.push('부제');
          if (json(r?.omit) !== json(b.omit)) fields.push(r?.omit?.length ? `선택지 빠짐(${r.omit.join(', ')})` : '선택지 구성');
          notes.push(fields.join(', ') || '내용');
        }
      }
      const o = json(optionsOf(id, v.ctx).map((x) => x.key));
      if (o !== baseOpts) {
        const a = new Set(optionsOf(id, base).map((x) => x.key));
        const add = optionsOf(id, v.ctx).map((x) => x.key).filter((k) => !a.has(k));
        notes.push(add.length ? `선택지 추가(${add.join(', ')})` : '선택지 구성');
      }
      if (cine && typeof cine.story === 'function' && json(cine.story({ ...v.ctx, elapsed: 0 })) !== baseStory) notes.push('이야기 문장');
    } catch { /* 이 조합에서는 시험할 수 없다 */ }
    if (notes.length) contentDiffs.push(`${v.label} → ${[...new Set(notes)].join(' / ')}`);
  }

  rows.push({
    id, chapter: CHAPTERS[s.chapter] ?? '', renderer: s.renderer,
    title: (q && q.title) || (cine && cine.title) || '',
    answerKey: s.answerKey ?? (cine ? '(밤 장면: 선택지별 상태값)' : ''),
    options: optionsOf(id, base),
    defaultNext, nextDiffs, contentDiffs, scored: scored[id] ?? [],
    nightOnly: !!s.nightOnly,
  });
}

// ── 밤 장면 상태값(flag): 어디서 만들고 어디서 읽는가 ──
const flagSetBy = {};
for (const c of demoScenes) {
  for (const run of [1, 2]) {
    const opts = typeof c.options === 'function' ? c.options({ ...baseCtx(), run }) : c.options;
    for (const o of opts) for (const f of Object.keys(o.sets ?? {})) (flagSetBy[f] ??= new Set()).add(`${c.id}:${o.id}`);
  }
}
const flagReadBy = {};
for (const r of rows) for (const d of [...r.contentDiffs, ...r.nextDiffs]) {
  const m = d.match(/^flag:([A-Za-z0-9_]+) → (.*)$/);
  if (m) (flagReadBy[m[1]] ??= []).push(`${r.id}: ${m[2]}`);
}

// ── 문서 쓰기 ──
const md = [];
const esc = (t) => String(t).replace(/\|/g, '\\|');
md.push('# 분기 지도 (자동 생성)');
md.push('');
md.push(`생성: ${new Date().toLocaleDateString('sv-SE')} · 명령: \`node tools/branch_map.cjs\` · **이 파일을 직접 고치지 마세요.** 코드를 바꾼 뒤 다시 생성합니다.`);
md.push('');
md.push('선택지를 하나씩 바꿔 가며 실제로 무엇이 달라지는지 시험한 결과입니다. 한 번에 하나의 선택만 바꿔 보므로, 두 선택이 함께일 때만 달라지는 규칙은 잡히지 않습니다.');
md.push('');

const changing = rows.filter((r) => r.nextDiffs.length || r.contentDiffs.length);
md.push('## 요약');
md.push('');
md.push(`- 장면 ${rows.length}개 (밤 장면 전용 ${rows.filter((r) => r.nightOnly).length}개)`);
md.push(`- 앞 선택에 따라 **내용이나 다음 장면이 달라지는 장면** ${changing.length}개: ${changing.map((r) => r.id).join(', ') || '없음'}`);
const noEffect = Object.entries(answerValues).filter(([k]) => !rows.some((r) => [...r.contentDiffs, ...r.nextDiffs].some((d) => d.startsWith(k + '='))));
md.push(`- **뒤 내용에 영향을 주지 않는 선택(성향 점수와 결과 카드에만 쓰임)**: ${noEffect.map(([k]) => '`' + k + '`').join(', ') || '없음'}`);
md.push('');

md.push('## 장면별 표');
md.push('');
md.push('| 장면 | 챕터 | 화면 | 질문 | 선택지(값) | 성향 점수 | 기본 다음 장면 | 다음 장면이 달라지는 조건 | 내용이 달라지는 조건 |');
md.push('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  md.push(`| ${r.id}${r.nightOnly ? ' 🌙' : ''} | ${r.chapter} | ${r.renderer} | ${esc(short(r.title, 28))} | ${esc(r.options.map((o) => o.key).join(', '))} | ${r.scored.length ? '✔' : ''} | ${r.defaultNext} | ${esc(r.nextDiffs.join('<br>'))} | ${esc(r.contentDiffs.join('<br>'))} |`);
}
md.push('');
md.push('🌙 = `?night=1` 로 들어온 경우에만 나오는 밤 장면');
md.push('');

md.push('## 선택이 뒤를 바꾸는 곳 (선택 → 영향)');
md.push('');
const byKey = {};
for (const r of rows) for (const d of [...r.nextDiffs, ...r.contentDiffs]) {
  const [cond, eff] = d.split(' → ');
  (byKey[cond] ??= []).push(`**${r.id}** ${eff}`);
}
for (const [cond, effs] of Object.entries(byKey)) md.push(`- \`${cond}\` → ${effs.join(' · ')}`);
md.push('');

md.push('## 밤 장면의 상태값(flag)');
md.push('');
md.push('| 상태값 | 어디서 남기나 | 어디서 읽나 |');
md.push('|---|---|---|');
for (const f of [...flagNames]) md.push(`| \`${f}\` | ${[...(flagSetBy[f] ?? [])].join(', ')} | ${esc((flagReadBy[f] ?? ['읽는 곳 없음 (성향 점수나 선택지 문구·태그에서만 쓰일 수 있음)']).join(' / '))} |`);
md.push('');

md.push('## 흐름도');
md.push('');
md.push('```mermaid');
md.push('flowchart TD');
const mainIds = rows.filter((r) => !r.nightOnly).map((r) => r.id);
for (const r of rows) {
  md.push(`  ${r.id}["${r.id}\\n${short(r.title, 14).replace(/"/g, "'")}"]`);
}
md.push(`  ${RESULT}(["결과"])`);
const seen = new Set();
const edge = (a, b, label) => { const k = a + b + label; if (seen.has(k)) return; seen.add(k); md.push(`  ${a} ${label ? `-->|${label}|` : '-->'} ${b}`); };
for (const r of rows) {
  edge(r.id, r.defaultNext, '');
  for (const d of r.nextDiffs) {
    const m = d.match(/^(.*) → (\S+)$/);
    if (m) edge(r.id, m[2], m[1].replace(/[^A-Za-z0-9=: ]/g, ''));
  }
}
md.push('```');
md.push('');
md.push('## 문서에 없는 규칙을 찾는 법');
md.push('- 새 분기를 만들 때는 이 문서를 먼저 다시 생성해서 "의도하지 않은 영향"이 생기지 않았는지 확인합니다.');
md.push('- 선택이 아무 영향도 주지 않는다면 위 요약의 "영향 없는 선택" 목록에 나타납니다.');
md.push('- 선택지 목록에 없는 숨은 값(예: `companion=dog`)은 스크립트의 `HIDDEN_VALUES` 에 적어야 지도에 나타납니다.');
md.push('');

fs.writeFileSync(path.join(ROOT, '분기_지도.md'), md.join('\n'), 'utf8');
console.log('분기_지도.md 생성: 장면 ' + rows.length + '개, 달라지는 장면 ' + changing.length + '개');
