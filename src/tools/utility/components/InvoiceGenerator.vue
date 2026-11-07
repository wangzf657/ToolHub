<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Plus, Trash2, Printer } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const meta = reactive({
  company: '某某科技有限公司',
  companyInfo: '地址：某某市某某区某某路 88 号\n电话：400-000-0000',
  client: '',
  clientInfo: '',
  number: 'INV-2024-001',
  date: new Date().toISOString().slice(0, 10),
  due: '',
  currency: '¥',
  note: '',
})

interface Item { desc: string; qty: number; price: number; taxRate: number }
const items = reactive<Item[]>([
  { desc: '示例服务：网站设计与开发', qty: 1, price: 8000, taxRate: 6 },
])

const addItem = () => {
  items.push({ desc: '', qty: 1, price: 0, taxRate: 0 })
}
const removeItem = (i: number) => {
  if (items.length === 1) {
    toast.warn('至少保留一行明细')
    return
  }
  items.splice(i, 1)
}

const fmt = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const sums = computed(() => {
  let subtotal = 0
  let tax = 0
  for (const it of items) {
    const line = (Number(it.qty) || 0) * (Number(it.price) || 0)
    subtotal += line
    tax += line * ((Number(it.taxRate) || 0) / 100)
  }
  return { subtotal, tax, total: subtotal + tax }
})

/** 新窗口打开可打印页面（用户可用浏览器「另存为 PDF」） */
const printInvoice = () => {
  const w = window.open('', '_blank', 'width=880,height=980')
  if (!w) {
    toast.err('浏览器拦截了新窗口，请允许弹出窗口后重试')
    return
  }
  const rowsHtml = items
    .map(
      (it, i) => `<tr>
        <td>${i + 1}</td><td>${esc(it.desc) || '—'}</td>
        <td style="text-align:right">${esc(String(it.qty))}</td>
        <td style="text-align:right">${fmt(Number(it.price) || 0)}</td>
        <td style="text-align:right">${Number(it.taxRate) || 0}%</td>
        <td style="text-align:right">${fmt((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
      </tr>`,
    )
    .join('')
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  w.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(meta.number)}</title>
  <style>
    body{font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;color:#111;padding:40px;max-width:800px;margin:0 auto}
    h1{font-size:26px;margin:0 0 4px} h2{font-size:13px;font-weight:400;color:#555;margin:0 0 24px}
    .meta{display:flex;justify-content:space-between;gap:20px;margin-bottom:24px;font-size:13px;white-space:pre-line}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left}
    th{background:#f6f6f6}
    .totals{margin-top:14px;text-align:right;font-size:13px;line-height:1.9}
    .totals b{font-size:18px}
    .note{margin-top:26px;font-size:12px;color:#555;white-space:pre-line}
  </style></head><body>
  <h1>发票 / INVOICE</h1><h2>编号 ${esc(meta.number)} · 日期 ${esc(meta.date)}${meta.due ? ` · 到期 ${esc(meta.due)}` : ''}</h2>
  <div class="meta">
    <div><strong>开票方</strong>\n${esc(meta.company)}\n${esc(meta.companyInfo)}</div>
    <div><strong>客户</strong>\n${esc(meta.client) || '—'}\n${esc(meta.clientInfo)}</div>
  </div>
  <table><thead><tr><th>#</th><th>描述</th><th style="text-align:right">数量</th><th style="text-align:right">单价</th><th style="text-align:right">税率</th><th style="text-align:right">小计</th></tr></thead>
  <tbody>${rowsHtml}</tbody></table>
  <div class="totals">
    小计：${meta.currency}${fmt(sums.value.subtotal)}<br/>
    税额：${meta.currency}${fmt(sums.value.tax)}<br/>
    <b>合计：${meta.currency}${fmt(sums.value.total)}</b>
  </div>
  ${meta.note ? `<div class="note">备注：${esc(meta.note)}</div>` : ''}
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`)
  w.document.close()
}
</script>

<template>
  <div>
    <div class="grid-2">
      <div>
        <span class="field-label">公司 / 开票方</span>
        <input v-model="meta.company" class="input" />
        <span class="field-label mt-1">公司信息（地址 / 电话等）</span>
        <textarea v-model="meta.companyInfo" class="textarea" style="min-height: 64px"></textarea>
      </div>
      <div>
        <span class="field-label">客户名称</span>
        <input v-model="meta.client" class="input" placeholder="客户或个人名称" />
        <span class="field-label mt-1">客户信息</span>
        <textarea v-model="meta.clientInfo" class="textarea" style="min-height: 64px" placeholder="地址 / 邮箱等"></textarea>
      </div>
    </div>

    <div class="grid-4 mt-2">
      <div>
        <span class="field-label">发票编号</span>
        <input v-model="meta.number" class="input mono" />
      </div>
      <div>
        <span class="field-label">开票日期</span>
        <input v-model="meta.date" type="date" class="input" />
      </div>
      <div>
        <span class="field-label">到期日期（可选）</span>
        <input v-model="meta.due" type="date" class="input" />
      </div>
      <div>
        <span class="field-label">货币符号</span>
        <input v-model="meta.currency" class="input" style="width: 80px" />
      </div>
    </div>

    <div class="mt-2">
      <div class="io-head">
        <span class="io-title">明细项目</span>
        <button class="btn btn-soft btn-sm" @click="addItem"><Plus :size="14" /> 添加一行</button>
      </div>
      <div class="table-wrap mt-1">
        <table class="data-table">
          <thead>
            <tr>
              <th style="min-width: 220px">描述</th>
              <th>数量</th><th>单价</th><th>税率 %</th><th>小计</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(it, i) in items" :key="i">
              <td><input v-model="it.desc" class="input item-in" placeholder="项目描述" /></td>
              <td><input v-model.number="it.qty" type="number" class="input item-in num" min="0" /></td>
              <td><input v-model.number="it.price" type="number" class="input item-in num" min="0" /></td>
              <td><input v-model.number="it.taxRate" type="number" class="input item-in num" min="0" /></td>
              <td class="mono">{{ meta.currency }}{{ fmt((Number(it.qty) || 0) * (Number(it.price) || 0)) }}</td>
              <td>
                <button class="mini-del" title="删除此行" @click="removeItem(i)"><Trash2 :size="14" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="totals mt-2">
      <div class="t-row"><span>小计</span><span class="mono">{{ meta.currency }}{{ fmt(sums.subtotal) }}</span></div>
      <div class="t-row"><span>税额</span><span class="mono">{{ meta.currency }}{{ fmt(sums.tax) }}</span></div>
      <div class="t-row t-main"><span>合计</span><span class="mono">{{ meta.currency }}{{ fmt(sums.total) }}</span></div>
    </div>

    <div class="mt-2">
      <span class="field-label">备注（可选）</span>
      <textarea v-model="meta.note" class="textarea" style="min-height: 60px" placeholder="付款方式、备注说明等"></textarea>
    </div>

    <div class="row mt-2">
      <button class="btn btn-primary" @click="printInvoice">
        <Printer :size="16" /> 打印 / 另存 PDF
      </button>
      <span class="muted small">将打开打印预览窗口，可在系统打印对话框中选择「另存为 PDF」</span>
    </div>
  </div>
</template>

<style scoped>
.io-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.io-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.item-in {
  padding: 6px 10px;
  font-size: 13.5px;
}
.item-in.num {
  width: 90px;
}
.mini-del {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.mini-del:hover {
  border-color: var(--err);
  color: var(--err);
}
.totals {
  margin-left: auto;
  max-width: 320px;
  display: grid;
  gap: 6px;
}
.t-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-2);
}
.t-main {
  padding-top: 8px;
  border-top: 1px solid var(--border-strong);
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
}
</style>
