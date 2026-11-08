<script setup lang="ts">
/** 在线代码运行器：HTML/CSS/JS 拼合 srcdoc，iframe sandbox="allow-scripts" 隔离运行，console 重定向回主页面 */
import { onBeforeUnmount, ref } from 'vue'
import { Eraser, Play, Trash2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const html = ref('<h2>Hello ToolHub</h2>\n<p>编辑左边代码，点「运行」看结果。</p>')
const css = ref('body{font-family:system-ui,sans-serif;color:#333}\nh2{color:#2f6fd6}')
const js = ref("console.log('来自 JS 的日志');\nfor (let i = 1; i <= 3; i++) console.log(`第 ${i} 次循环`);")

const logs = ref<{ kind: string; text: string }[]>([])
const preview = ref<HTMLElement | null>(null)

/**
 * 注入沙盒页头的脚本：重写 console 与错误捕获，postMessage 回主页面。
 * 每一步独立 try/catch——个别环境（部分 WebView）console 属性只读，赋值会抛错，
 * 决不能让桥接脚本整体中断（onerror 注册不依赖 console，必须保证成功）。
 */
const BRIDGE = `<script>
(function(){
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
  window.onerror=function(m,s,l){ send('error',[m+(l?('（第 '+l+' 行）'):'')]); };
  window.addEventListener('unhandledrejection',function(ev){
    var r=ev&&ev.reason; send('error',['未处理的 Promise 异常：'+((r&&(r.message||r))||String(r))]);
  });
  // 启动自检：证明桥接链路通畅（与用户代码无关）
  send('log',['▶ 沙盒已启动，console 输出将显示在此']);
})()<\/script>`

const buildSrcdoc = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css.value}</style></head><body>${html.value}${BRIDGE}<script>${js.value}<\/script></body></html>`

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

const onMessage = (e: MessageEvent) => {
  const d = e.data as { __playground?: boolean; kind?: string; text?: string }
  if (!d || !d.__playground) return
  logs.value.push({ kind: d.kind ?? 'log', text: d.text ?? '' })
  if (logs.value.length > 200) logs.value.splice(0, logs.value.length - 200)
}
window.addEventListener('message', onMessage)
onBeforeUnmount(() => window.removeEventListener('message', onMessage))

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
    <div class="row row-wrap mb-2" style="gap: 8px">
      <button class="btn btn-primary btn-sm" @click="run"><Play :size="14" /> 运行</button>
      <button class="btn btn-ghost btn-sm" @click="logs = []"><Eraser :size="14" /> 清空日志</button>
      <button class="btn btn-ghost btn-sm" @click="saveDraft">保存草稿</button>
      <button class="btn btn-ghost btn-sm" @click="loadDraft">载入草稿</button>
    </div>

    <div class="pg-grid">
      <div class="pane">
        <span class="pane-title">HTML</span>
        <textarea v-model="html" class="textarea mono" style="min-height: 150px" spellcheck="false"></textarea>
      </div>
      <div class="pane">
        <span class="pane-title">CSS</span>
        <textarea v-model="css" class="textarea mono" style="min-height: 150px" spellcheck="false"></textarea>
      </div>
      <div class="pane">
        <span class="pane-title">JavaScript</span>
        <textarea v-model="js" class="textarea mono" style="min-height: 150px" spellcheck="false"></textarea>
      </div>
    </div>

    <div class="pg-bottom">
      <div class="pane">
        <span class="pane-title">预览（sandbox 隔离，不访问本站数据）</span>
        <div ref="preview" class="pg-frame"></div>
      </div>
      <div class="pane">
        <span class="pane-title">控制台（console / 报错）</span>
        <div class="pg-console mono">
          <div v-if="!logs.length" class="muted small" style="padding: 10px">运行后，console.log 输出会显示在这里…</div>
          <div v-for="(l, i) in logs" :key="i" class="log-line" :class="l.kind">{{ l.text }}</div>
        </div>
      </div>
    </div>

    <p class="notice notice-info mt-2 small">运行环境为 iframe 沙盒（仅 allow-scripts，不授予同源权限），无法访问页面数据与 Cookie；支持 ES2020 语法与常用浏览器 API。</p>
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
.pg-frame {
  height: 240px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}
.pg-console {
  height: 240px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
  font-size: 12.5px;
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
