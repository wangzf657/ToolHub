// 数据工具档案结构化字段提取（仅读档案，不改业务代码）
import fs from 'node:fs';
import path from 'node:path';

const dir = 'D:/workspace/ai/Toolhub/docs/优化文档/数据工具';
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

  // 总分：## 七维评分：xx / 100
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

  // 头部引言：模式、组件、对标
  rec.head = lines.filter(l => /^> /.test(l)).map(l => l.replace(/^> /, ''));
  const modeLine = rec.head.find(h => /模式/.test(h)) || '';
  const mm = modeLine.match(/模式：([A-F](?:\s?变体)?)/);
  rec.mode = mm ? mm[1] : '?';

  // 结论与优先级小节
  const conclIdx = lines.findIndex(l => /^## 结论与优先级/.test(l));
  if (conclIdx >= 0) {
    const seg = [];
    for (let i = conclIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) seg.push(lines[i]);
    rec.conclusionBlock = seg.filter(s => s.trim()).slice(0, 8);
    rec.conclusion = seg.find(s => /·\s*P\d/.test(s)) || seg.find(s => s.trim().startsWith('**'));
    rec.judge = seg.find(s => /^判据/.test(s));
    rec.order = seg.find(s => /^整改优先序/.test(s));
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

  // 处方标题行（**xxx**：）
  const rxIdx = lines.findIndex(l => /^## 优化处方/.test(l));
  if (rxIdx >= 0) {
    rec.prescriptions = [];
    for (let i = rxIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
      const l = lines[i];
      const pm = l.match(/^\d+\.\s\*\*(.+?)\*\*/);
      if (pm) rec.prescriptions.push(pm[1]);
      else if (/^\d+\.\s/.test(l.trim())) rec.prescriptions.push(l.trim().slice(0, 60));
    }
  }

  // 关键词命中（家族/病灶判定用）
  rec.hits = {
    pinHeight: (text.match(/钉\s?\d+px|钉高|max-height|height:\s*\d+px/g) || []).length,
    zeroInterlink: /零互链|互不相认|互不链接/.test(text) ? 1 : 0,
    silentCorrect: /静默|无披露|无提示.*归\s?0|按 0 计/.test(text) ? 1 : 0,
    encoding: /编码|GBK|TextDecoder/.test(text) ? 1 : 0,
    engineNoUi: /有引擎无界面|未暴露|未用|未取|未接入|已存在.*未|能力倒挂|闲置/.test(text) ? 1 : 0,
    promises: /承诺|名不副实|失信|与实现不符|自相矛盾|desc 与实现/.test(text) ? 1 : 0,
  };

  // 行业对标小节标杆名
  const benchIdx = lines.findIndex(l => /^## 行业对标与差距/.test(l));
  if (benchIdx >= 0) {
    const seg = [];
    for (let i = benchIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) seg.push(lines[i]);
    rec.benchmarks = seg.join(' ');
  }

  out.push(rec);
}

const scores = out.map(r => r.score).filter(s => s != null).sort((a, b) => a - b);
const avg = arr => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
const dimsAvg = {};
for (const k of ['func','usab','val','iact','ui','soul','perf','mob']) dimsAvg[k] = +avg(out.map(r => r.dims[k] || 0)).toFixed(2);

const stat = {
  count: out.length,
  avg: +avg(scores).toFixed(2),
  median: scores.length % 2 ? scores[(scores.length-1)/2] : +((scores[scores.length/2-1]+scores[scores.length/2])/2).toFixed(1),
  min: scores[0], max: scores[scores.length-1],
  top5: [...out].sort((a,b) => b.score - a.score).slice(0,5).map(r => `${r.slug} ${r.score}`),
  bottom5: [...out].sort((a,b) => a.score - b.score).slice(0,5).map(r => `${r.slug} ${r.score}`),
  dist: {
    ge60: scores.filter(s => s >= 60).length,
    mid55: scores.filter(s => s >= 55 && s < 60).length,
    le54: scores.filter(s => s < 55).length,
  },
  p0: out.filter(r => /P0/.test(r.conclusion || '')).map(r => `${r.slug} ${r.score}`),
  p1: out.filter(r => /P1/.test(r.conclusion || '')).map(r => `${r.slug} ${r.score}`),
  p2: out.filter(r => /P2/.test(r.conclusion || '')).map(r => `${r.slug} ${r.score}`),
  modes: out.reduce((acc, r) => { acc[r.mode] = (acc[r.mode]||0)+1; return acc; }, {}),
  dimsAvg,
  keywords: {
    zeroInterlink: out.filter(r => r.hits.zeroInterlink).map(r => r.slug),
    silentCorrect: out.filter(r => r.hits.silentCorrect).map(r => r.slug),
    encoding: out.filter(r => r.hits.encoding).map(r => r.slug),
    engineNoUi: out.filter(r => r.hits.engineNoUi).map(r => r.slug),
    promises: out.filter(r => r.hits.promises).map(r => r.slug),
  },
};
fs.writeFileSync('D:/workspace/ai/Toolhub/docs/优化文档/_scripts/data-extract.json', JSON.stringify({ stat, tools: out }, null, 1));
console.log(JSON.stringify(stat, null, 1));
