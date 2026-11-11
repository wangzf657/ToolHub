// 商业SaaS 档案结构化字段提取（仅读档案，不改业务代码）
import fs from 'node:fs';
import path from 'node:path';

const dir = 'D:/workspace/ai/Toolhub/docs/优化文档/商业SaaS';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_'));
const out = [];

for (const f of files.sort()) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = text.split(/\r?\n/);
  const rec = { file: f.replace(/\.md$/, '') };

  const title = lines.find(l => /^# /.test(l)) || '';
  const m = title.match(/^# (.+?)（(.+?)）$/);
  rec.name = m ? m[1] : title;
  rec.slug = m ? m[2] : rec.file;

  const scoreLine = lines.find(l => /^## 七维评分/.test(l));
  rec.score = scoreLine ? parseInt((scoreLine.match(/(\d+)/) || [])[1], 10) : null;

  rec.dims = {};
  for (const [key, label] of [['func','功能完善性'],['usab','可用性'],['val','实用价值'],['iact','交互便捷性'],['ui','UI 美观性'],['soul','灵魂度'],['perf','大文件性能'],['mob','移动端']]) {
    const row = lines.find(l => l.includes(`| ${label} |`) && !l.includes('满分')) || lines.find(l => l.includes(`附加：${label} |`));
    if (row) {
      const cells = row.split('|').map(s => s.trim());
      rec.dims[key] = parseInt(cells[3] ?? cells[2], 10) || 0;
    }
  }

  rec.head = lines.filter(l => /^> /.test(l)).map(l => l.replace(/^> /, ''));
  rec.mode = (rec.head[0] || '').match(/模式：(.+?)｜/)?.[1] || '';
  rec.bench = (rec.head.join(' ') || '').match(/对标标杆：(.+)$/)?.[1] || '';

  const conclIdx = lines.findIndex(l => /^## 结论与优先级/.test(l));
  if (conclIdx >= 0) {
    const seg = [];
    for (let i = conclIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) seg.push(lines[i]);
    rec.conclusion = seg.find(s => /·\s*P\d/.test(s)) || seg.find(s => s.trim().startsWith('**'));
    rec.judge = seg.find(s => /^判据/.test(s));
    rec.order = seg.find(s => /^整改优先序/.test(s));
  }

  const dedIdx = lines.findIndex(l => /^## 扣分点明细/.test(l));
  if (dedIdx >= 0) {
    rec.deductions = [];
    for (let i = dedIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
      const l = lines[i];
      if (/^\d+\.\s/.test(l.trim())) rec.deductions.push(l.trim());
    }
  }

  const rxIdx = lines.findIndex(l => /^## 优化处方/.test(l));
  if (rxIdx >= 0) {
    rec.prescriptions = [];
    for (let i = rxIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
      const l = lines[i];
      const mm = l.match(/^\d+\.\s\*\*(.+?)\*\*/);
      if (mm) rec.prescriptions.push(mm[1]);
      else if (/^\d+\.\s/.test(l.trim())) rec.prescriptions.push(l.trim().slice(0, 50));
    }
  }

  const benchIdx = lines.findIndex(l => /^## 行业对标与差距/.test(l));
  if (benchIdx >= 0) {
    const seg = [];
    for (let i = benchIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) seg.push(lines[i]);
    rec.benchmarks = seg.filter(s => /^- \*\*/.test(s.trim())).map(s => s.trim().match(/^- \*\*(.+?)\*\*/)?.[1] || '');
  }

  const extIdx = lines.findIndex(l => /^## 可拓展性/.test(l));
  if (extIdx >= 0) {
    const seg = [];
    for (let i = extIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) seg.push(lines[i]);
    rec.short = (seg.find(s => /短期/.test(s)) || '').trim();
    rec.mid = (seg.find(s => /中期/.test(s)) || '').trim();
    rec.long = (seg.find(s => /远期/.test(s)) || '').trim();
  }

  out.push(rec);
}

const scores = out.map(r => r.score).filter(s => s != null);
const avg = k => {
  const arr = out.map(r => r.dims[k]).filter(v => v != null);
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
};
const stat = {
  n: out.length,
  avg: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
  max: Math.max(...scores), min: Math.min(...scores),
  dimAvg: { func: avg('func'), usab: avg('usab'), val: avg('val'), iact: avg('iact'), ui: avg('ui'), soul: avg('soul'), mob: avg('mob'), perf: avg('perf') },
  sorted: out.slice().sort((a,b)=>(b.score??0)-(a.score??0)).map(r => `${r.slug}=${r.score}`),
  p0: out.filter(r => /P0/.test(r.conclusion || '')).map(r => r.slug),
  p1: out.filter(r => /P1/.test(r.conclusion || '')).map(r => r.slug),
  p2: out.filter(r => /P2/.test(r.conclusion || '')).map(r => r.slug),
  suspect: out.filter(r => /疑似功能问题/.test((r.conclusion||'') + (r.judge||'') + (r.order||''))).map(r => r.slug),
  modes: {},
  custom: out.filter(r => /自定义/.test(r.mode)).map(r => r.slug),
  calcDef: out.filter(r => /calcDef|CalcTool/.test(r.mode)).map(r => r.slug),
};
for (const r of out) { const k = r.mode.split('（')[0]; stat.modes[k] = (stat.modes[k]||0)+1; }

console.log(JSON.stringify({ stat, tools: out }, null, 1));
