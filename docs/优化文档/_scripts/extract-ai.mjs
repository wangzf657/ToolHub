// AI 工具档案结构化字段提取（仅读档案，不改业务代码）
import fs from 'node:fs';
import path from 'node:path';

const dir = 'D:/workspace/ai/Toolhub/docs/优化文档/AI工具';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_'));
const out = [];

for (const f of files.sort()) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = text.split(/\r?\n/);
  const rec = { file: f.replace(/\.md$/, '') };

  // 标题行：# 中文名（slug）
  const title = lines.find(l => /^# /.test(l)) || '';
  const m = title.match(/^# (.+?)（(.+?)）$/);
  rec.name = m ? m[1] : title;
  rec.slug = m ? m[2] : rec.file;

  // 总分
  const scoreLine = lines.find(l => /^## 七维评分/.test(l));
  rec.score = scoreLine ? parseInt((scoreLine.match(/(\d+)/) || [])[1], 10) : null;

  // 七维表
  rec.dims = {};
  for (const [key, label] of [['func','功能完善性'],['usab','可用性'],['val','实用价值'],['iact','交互便捷性'],['ui','UI 美观性'],['soul','灵魂度'],['perf','大文件性能'],['mob','移动端']]) {
    const row = lines.find(l => l.includes(`| ${label} |`) && !l.includes('满分')) || lines.find(l => l.includes(`附加：${label} |`));
    if (row) {
      const cells = row.split('|').map(s => s.trim());
      rec.dims[key] = parseInt(cells[3] ?? cells[2], 10) || 0;
    }
  }

  // 头部引言：模式、组件、引擎、注册、对标
  rec.head = lines.filter(l => /^> /.test(l)).map(l => l.replace(/^> /, ''));

  // 结论与优先级
  const conclIdx = lines.findIndex(l => /^## 结论与优先级/.test(l));
  if (conclIdx >= 0) {
    const seg = [];
    for (let i = conclIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) seg.push(lines[i]);
    rec.conclusion = seg.find(s => /·\s*P\d/.test(s)) || seg.find(s => s.trim().startsWith('**'));
    rec.judge = seg.find(s => /^判据/.test(s));
  }

  // 扣分点明细（每条首行）
  const dedIdx = lines.findIndex(l => /^## 扣分点明细/.test(l));
  if (dedIdx >= 0) {
    rec.deductions = [];
    for (let i = dedIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
      const l = lines[i];
      if (/^\d+\.\s/.test(l.trim())) rec.deductions.push(l.trim());
    }
  }

  // 优化处方（**xxx**：）
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

  // 行业对标小节
  const benchIdx = lines.findIndex(l => /^## 行业对标与差距/.test(l));
  if (benchIdx >= 0) {
    const seg = [];
    for (let i = benchIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) seg.push(lines[i]);
    rec.benchmarks = seg.filter(s => /^- \*\*/.test(s.trim())).map(s => s.trim().match(/^- \*\*(.+?)\*\*/)?.[1] || '');
  }

  out.push(rec);
}

const scores = out.map(r => r.score).filter(s => s != null);
const stat = {
  n: out.length,
  avg: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
  max: Math.max(...scores), min: Math.min(...scores),
  sorted: out.slice().sort((a,b)=>(b.score??0)-(a.score??0)).map(r => `${r.slug}=${r.score}`),
  p0: out.filter(r => /P0/.test(r.conclusion || '')).length,
  p1: out.filter(r => /P1/.test(r.conclusion || '')).length,
  p2: out.filter(r => /P2/.test(r.conclusion || '')).length,
};
console.log(JSON.stringify({ stat, tools: out }, null, 1));
