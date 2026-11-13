<script setup lang="ts">
/** 在线代码运行器：HTML/CSS/JS 拼合 srcdoc，iframe sandbox="allow-scripts" 隔离运行，console 重定向回主页面。
 *  增强：弹性高度+全屏、Ctrl/Cmd+Enter 与自动运行、CDN 库快捷引入、JS 行号映射、示例模板库、导出 .html。 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { Eraser, Maximize2, Play, Trash2, Download } from 'lucide-vue-next'
import { saveText } from '@/lib/download'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const html = ref('<h2>Hello ToolHub</h2>\n<p>编辑左边代码，点「运行」看结果。</p>')
const css = ref('body{font-family:system-ui,sans-serif;color:#333}\nh2{color:#2f6fd6}')
const js = ref("console.log('来自 JS 的日志');\nfor (let i = 1; i <= 3; i++) console.log(`第 ${i} 次循环`);")

const logs = ref<{ kind: string; text: string }[]>([])
const preview = ref<HTMLElement | null>(null)
/** 自动运行（400ms 防抖） */
const autoRun = ref(false)
/** 全屏（预览 / 控制台） */
const fullPane = ref<'' | 'preview' | 'console'>('')
/** CDN 库快捷引入（勾选即注入固定版本 script） */
const libs = ref({ vue3: false, jquery: false, lodash: false })

const LIB_URLS: Record<keyof typeof libs.value, string> = {
  vue3: 'https://unpkg.com/vue@3.4.38/dist/vue.global.prod.js',
  jquery: 'https://unpkg.com/jquery@3.7.1/dist/jquery.min.js',
  lodash: 'https://unpkg.com/lodash@4.17.21/lodash.min.js',
}

/**
 * 注入沙盒页头的脚本：重写 console 与错误捕获，postMessage 回主页面。
 * 每一步独立 try/catch——个别环境（部分 WebView）console 属性只读，赋值会抛错，
 * 决不能让桥接脚本整体中断（onerror 注册不依赖 console，必须保证成功）。
 * __JS_OFFSET__ 运行时替换为 JS 代码的起始行偏移，onerror 报「JS 第 N 行」。
 */
const BRIDGE = `<script>
(function(){
  var JSLINE=__JS_OFFSET__;
  var send=function(kind,args){
    try{parent.postMessage({__playground:true,kind:kind,text:Array.prototype.map.call(args,function(a){
      if(a instanceof Error) return a.message;
      try { return typeof a==='object'&&a!==null?JSON.stringify(a):String(a) } catch(e){ return String(a) }
    }).join(' ')},'*')}catch(e){}
  };
  ['log','info','warn','error'].forEach(function(k){
    try{
      var orig=console[k];
      var wrapped=function(){ send(k,arguments); try{orig&&orig.apply(console,arguments)}catch(e){} };
      try{ console[k]=wrapped; }catch(e){}
      // 赋值失败（属性只读）时尝试 defineProperty 强制重写
      if(console[k]!==wrapped){ Object.defineProperty(console,k,{value:wrapped,writable:true,configurable:true}); }
    }catch(e){}
  });
  window.onerror=function(m,s,l){ var loc=l?(l>JSLINE?('（JS 第 '+(l-JSLINE)+' 行）'):('（第 '+l+' 行）')):''; send('error',[m+loc]); };
  window.addEventListener('unhandledrejection',function(ev){
    var r=ev&&ev.reason; send('error',['未处理的 Promise 异常：'+((r&&(r.message||r))||String(r))]);
  });
  // 启动自检：证明桥接链路通畅（与用户代码无关）
  send('log',['▶ 沙盒已启动，console 输出将显示在此']);
})()<\/script>`

const libTags = () =>
  (Object.keys(libs.value) as (keyof typeof libs.value)[])
    .filter((k) => libs.value[k])
    .map((k) => `<script src="${LIB_URLS[k]}"><\/script>`)
    .join('')

const buildSrcdoc = () => {
  const head = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css.value}</style></head><body>${html.value}`
  const bridge = BRIDGE.replace('__JS_OFFSET__', String((head.split('\n').length - 1) + (BRIDGE.split('\n').length - 1)))
  return `${head}${bridge}<script>${js.value}<\/script></body></html>`
}

/** 导出 .html：去掉桥接脚本的独立可运行版本（含已勾选的 CDN 引用） */
const exportHtml = () => {
  const head = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css.value}</style></head><body>${html.value}`
  const doc = `${head}${libTags()}<script>${js.value}<\/script></body></html>`
  saveText(doc, 'playground.html', 'text/html;charset=utf-8')
  toast.ok('已导出 playground.html（不含 console 桥接）')
}

const run = () => {
  if (!preview.value) return
  logs.value = []
  // 重建 iframe 即重新执行（不授予 allow-same-origin，页面间天然隔离）
  preview.value.innerHTML = ''
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.setAttribute('title', '运行预览')
  iframe.style.cssText = 'width:100%;height:100%;border:0;background:#fff'
  iframe.srcdoc = buildSrcdoc()
  preview.value.appendChild(iframe)
  toast.ok('已运行')
}

/* 自动运行：内容变化 400ms 防抖重跑 */
let autoTimer: number | null = null
watch([html, css, js], () => {
  if (!autoRun.value) return
  if (autoTimer !== null) window.clearTimeout(autoTimer)
  autoTimer = window.setTimeout(run, 400)
})
onBeforeUnmount(() => {
  if (autoTimer !== null) window.clearTimeout(autoTimer)
})

/* 编辑器快捷键：Ctrl/Cmd+Enter 运行 */
const onEditorKey = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    run()
  }
}

const onMessage = (e: MessageEvent) => {
  const d = e.data as { __playground?: boolean; kind?: string; text?: string }
  if (!d || !d.__playground) return
  logs.value.push({ kind: d.kind ?? 'log', text: d.text ?? '' })
  if (logs.value.length > 200) logs.value.splice(0, logs.value.length - 200)
}
window.addEventListener('message', onMessage)
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

/* ---------- 示例模板库 ---------- */
const TEMPLATES: { label: string; html: string; css: string; js: string }[] = [
  {
    label: 'Canvas 动画',
    html: '<canvas id="c" width="420" height="220" style="border:1px solid #ddd"></canvas>',
    css: 'body{font-family:system-ui,sans-serif}',
    js: "const c=document.getElementById('c').getContext('2d');\nlet x=40,y=60,vx=3,vy=2.4;\n(function loop(){\n  c.clearRect(0,0,420,220);\n  c.beginPath();c.arc(x,y,16,0,Math.PI*2);c.fillStyle='#2f6fd6';c.fill();\n  x+=vx;y+=vy;\n  if(x<16||x>404)vx=-vx;\n  if(y<16||y>204)vy=-vy;\n  requestAnimationFrame(loop);\n})();\nconsole.log('动画已启动');",
  },
  {
    label: 'DOM 事件',
    html: '<h2>点击计数器</h2>\n<button id="btn">点我 +1</button>\n<p>当前：<b id="n">0</b></p>',
    css: 'button{padding:8px 18px;font-size:15px;cursor:pointer}',
    js: "let n=0;\ndocument.getElementById('btn').addEventListener('click',()=>{\n  n++;\n  document.getElementById('n').textContent=n;\n  console.log('点击第',n,'次');\n});",
  },
  {
    label: 'fetch 请求',
    html: '<h2>fetch 示例</h2>\n<pre id="out">请求中…</pre>',
    css: 'pre{white-space:pre-wrap;background:#f4f6f8;padding:10px;border-radius:8px}',
    js: "fetch('https://jsonplaceholder.typicode.com/todos/1')\n  .then(r=>r.json())\n  .then(d=>{document.getElementById('out').textContent=JSON.stringify(d,null,2);console.log('拿到数据',d)})\n  .catch(e=>{document.getElementById('out').textContent='请求失败（离线或网络受限）：'+e.message;console.warn('fetch 失败',e.message)});",
  },
  {
    label: 'Storage 边界',
    html: '<h2>沙盒里的 localStorage</h2>\n<p id="r">测试中…</p>',
    css: 'body{font-family:system-ui,sans-serif}',
    js: "try{\n  localStorage.setItem('k','v');\n  document.getElementById('r').textContent='可写：'+localStorage.getItem('k');\n}catch(e){\n  document.getElementById('r').textContent='沙盒未授予同源权限，localStorage 被禁——这正是 try/catch 兜底的意义';\n  console.warn('预期内的边界：',e.message);\n}",
  },
]

const applyTemplate = (i: number) => {
  const t = TEMPLATES[i]
  html.value = t.html
  css.value = t.css
  js.value = t.js
  run()
  toast.ok(`已载入示例「${t.label}」`)
}

const saveDraft = () => {
  localStorage.setItem('toolhub:playground', JSON.stringify({ html: html.value, css: css.value, js: js.value }))
  toast.ok('草稿已保存到本地')
}
const loadDraft = () => {
  try {
    const d = JSON.parse(localStorage.getItem('toolhub:playground') ?? '')
    html.value = d.html ?? ''
    css.value = d.css ?? ''
    js.value = d.js ?? ''
    toast.ok('已载入本地草稿')
  } catch {
    toast.warn('暂无本地草稿')
  }
}
</script>

<template>
  <div>
    <div class="row row-wrap mb-2" style="gap: 8px; align-items: center">
      <button class="btn btn-primary btn-sm" @click="run"><Play :size="14" /> 运行</button>
      <label class="check small"><input v-model="autoRun" type="checkbox" /> 自动运行（停手 0.4s 后执行）</label>
      <span class="row" style="gap: 4px; align-items: center">
        <span class="muted small">库：</span>
        <label v-for="(url, k) in libs" :key="k" class="check small"><input v-model="libs[k]" type="checkbox" /> {{ k === 'vue3' ? 'Vue 3' : k === 'jquery' ? 'jQuery' : 'Lodash' }}</label>
      </span>
      <select class="select" style="width: auto" aria-label="示例模板" @change="applyTemplate(Number(($event.target as HTMLSelectElement).value))">
        <option value="" disabled selected>示例模板…</option>
        <option v-for="(t, i) in TEMPLATES" :key="t.label" :value="i">{{ t.label }}</option>
      </select>
      <button class="btn btn-ghost btn-sm" @click="logs = []"><Eraser :size="14" /> 清空日志</button>
      <button class="btn btn-ghost btn-sm" @click="saveDraft">保存草稿</button>
      <button class="btn btn-ghost btn-sm" @click="loadDraft">载入草稿</button>
      <button class="btn btn-ghost btn-sm" @click="exportHtml"><Download :size="14" /> 导出 .html</button>
    </div>

    <div class="pg-grid">
      <div class="pane">
        <span class="pane-title">HTML（Ctrl+Enter 运行）</span>
        <textarea v-model="html" class="textarea mono" style="min-height: 150px" spellcheck="false" @keydown="onEditorKey"></textarea>
      </div>
      <div class="pane">
        <span class="pane-title">CSS</span>
        <textarea v-model="css" class="textarea mono" style="min-height: 150px" spellcheck="false" @keydown="onEditorKey"></textarea>
      </div>
      <div class="pane">
        <span class="pane-title">JavaScript</span>
        <textarea v-model="js" class="textarea mono" style="min-height: 150px" spellcheck="false" @keydown="onEditorKey"></textarea>
      </div>
    </div>

    <div class="pg-bottom">
      <div class="pane" :class="{ 'pane-full': fullPane === 'preview' }">
        <span class="pane-title">
          预览（sandbox 隔离，不访问本站数据）
          <button class="mini-btn" :aria-label="fullPane === 'preview' ? '退出全屏' : '全屏预览'" @click="fullPane = fullPane === 'preview' ? '' : 'preview'"><Maximize2 :size="13" /></button>
        </span>
        <div ref="preview" class="pg-frame"></div>
      </div>
      <div class="pane" :class="{ 'pane-full': fullPane === 'console' }">
        <span class="pane-title">
          控制台（console / 报错）
          <button class="mini-btn" :aria-label="fullPane === 'console' ? '退出全屏' : '全屏控制台'" @click="fullPane = fullPane === 'console' ? '' : 'console'"><Maximize2 :size="13" /></button>
        </span>
        <div class="pg-console mono">
          <div v-if="!logs.length" class="muted small" style="padding: 10px">运行后，console.log 输出会显示在这里…</div>
          <div v-for="(l, i) in logs" :key="i" class="log-line" :class="l.kind">{{ l.text }}</div>
        </div>
      </div>
    </div>

    <p class="notice notice-info mt-2 small">运行环境为 iframe 沙盒（仅 allow-scripts，不授予同源权限），无法访问页面数据与 Cookie；勾选库会在沙盒内注入对应 CDN 固定版本（Vue 3 / jQuery / Lodash）；JS 报错会显示「JS 第 N 行」（行号为 JS 编辑器内的行）。再按 Ctrl+Enter（Mac 用 ⌘+Enter）即可重跑。</p>
  </div>
</template>

<style scoped>
.pg-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
@media (max-width: 900px) {
  .pg-grid {
    grid-template-columns: 1fr;
  }
}
.pane {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.pane-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mini-btn {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 6px;
  width: 22px;
  height: 20px;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
}
.mini-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
/* 预览/控制台弹性高度：视口口径，下限 400px；全屏 fixed 覆盖整页 */
.pg-frame {
  height: max(400px, calc(50vh - 100px));
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.pg-console {
  height: max(400px, calc(50vh - 100px));
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  font-size: 12.5px;
}
.pane-full {
  position: fixed;
  inset: 16px;
  z-index: 60;
  background: var(--bg);
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.pane-full .pg-frame,
.pane-full .pg-console {
  height: calc(100% - 30px);
}
.pg-bottom {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}
@media (max-width: 900px) {
  .pg-bottom {
    grid-template-columns: 1fr;
  }
}
.log-line {
  padding: 3px 10px;
  border-bottom: 1px dashed var(--border);
  white-space: pre-wrap;
  word-break: break-all;
}
.log-line.error {
  color: var(--danger, #d9534f);
}
.log-line.warn {
  color: #b58105;
}
</style>
