// 金融交易档案结构化字段提取（仅读档案，不改业务代码）
import fs from 'node:fs';
import path from 'node:path';

const dir = 'D:/workspace/ai/Toolhub/docs/优化文档/金融交易';
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

  // 七维得分
  rec.dims = {};
  for (const [key, label] of [['func','功能完善性'],['usab','可用性'],['val','实用价值'],['iact','交互便捷性'],['ui','UI 美观性'],['soul','灵魂度'],['perf','大文件性能'],['mob','移动端']]) {
    const row = lines.find(l => l.includes(`| ${label} |`) && !l.includes('满分')) || lines.find(l => l.includes(`附加：${label} |`));
    if (row) {
      const cells = row.split('|').map(s => s.trim());
      rec.dims[key] = parseInt(cells[3] ?? cells[2], 10) || 0;
    }
  }

  // 模式与组件（头部引言）
  rec.mode = (lines.find(l => /^> /.test(l) && l.includes('模式：')) || '').match(/模式：(.+?)｜/)?.[1] || '';
  rec.hasChart = /chartEngine|chart\.js/i.test(lines.slice(0, 5).join('\n')) || /chartEngine/.test(text);

  // 结论与优先级
  const conclIdx = lines.findIndex(l => /^## 结论与优先级/.test(l));
  if (conclIdx >= 0) {
    const seg = [];
    for (let i = conclIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) seg.push(lines[i]);
    rec.conclusion = (seg.find(s => /·\s*P\d/.test(s)) || '').trim();
    rec.priority = rec.conclusion.match(/P(\d)/)?.[1] || '';
    rec.judge = (seg.find(s => /^判据/.test(s)) || '').trim();
  }

  // 扣分点：疑似缺陷/硬伤/规约 违规标记
  const dedIdx = lines.findIndex(l => /^## 扣分点明细/.test(l));
  rec.deductions = [];
  rec.flags = [];
  if (dedIdx >= 0) {
    for (let i = dedIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
      const l = lines[i].trim();
      if (/^\d+\.\s/.test(l)) {
        rec.deductions.push(l);
        if (/疑似(功能缺陷|设计缺陷|功能问题)/.test(l)) rec.flags.push('疑似缺陷');
        if (/硬伤/.test(l)) rec.flags.push('硬伤');
        if (/规约/.test(l)) rec.flags.push('note规约违规');
        if (/缺陷/.test(l) && !/疑似/.test(l)) rec.flags.push('缺陷');
      }
    }
  }

  // note 有无（从注册行/灵魂度推断）：查档案中"无 note"字样
  rec.noNote = /无 note/.test(text);

  // 互链提及（跨工具互链缺失或处方）
  rec.linkMentions = (text.match(/互链/g) || []).length;

  // chartEngine 处方（优化处方中提到图表）
  const rxIdx = lines.findIndex(l => /^## 优化处方/.test(l));
  rec.rx = [];
  if (rxIdx >= 0) {
    for (let i = rxIdx + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
      const l = lines[i].trim();
      if (/^\d+\.\s\*\*.+?\*\*/.test(l)) rec.rx.push(l.match(/^\d+\.\s\*\*(.+?)\*\*/)?.[1]);
    }
  }
  rec.chartRx = rec.rx.some(r => /图|曲线|标尺|阶梯/.test(r || ''));

  // 空态问题
  rec.emptyIssue = /空态/.test(text) && (/(0 年|¥0|全 0|0\.00%|100\.0%|108\.33%)/.test(text));

  out.push(rec);
}

// 汇总统计
const scores = out.map(r => r.score);
const summary = {
  count: out.length,
  mean: (scores.reduce((a, b) => a + b, 0) / out.length).toFixed(1),
  max: Math.max(...scores), min: Math.min(...scores),
  byPriority: out.reduce((acc, r) => { acc['P' + r.priority] = (acc['P' + r.priority] || 0) + 1; return acc; }, {}),
  suspectedDefects: out.filter(r => r.flags.includes('疑似缺陷')).map(r => r.slug),
  hardDefects: out.filter(r => r.flags.includes('缺陷') && !r.flags.includes('疑似缺陷')).map(r => r.slug),
  hardWounds: out.filter(r => r.flags.includes('硬伤')).map(r => r.slug),
  noteViolations: out.filter(r => r.noNote).map(r => r.slug),
  dimMeans: {},
  ranking: [...out].sort((a, b) => b.score - a.score).map(r => `${r.slug}=${r.score}`),
};

for (const k of ['func','usab','val','iact','ui','soul','perf','mob']) {
  summary.dimMeans[k] = (out.reduce((a, r) => a + (r.dims[k] || 0), 0) / out.length).toFixed(1);
}

fs.writeFileSync('D:/workspace/ai/Toolhub/docs/优化文档/_scripts/finance-extract.json', JSON.stringify({ summary, records: out }, null, 2));
console.log(JSON.stringify(summary, null, 2));
