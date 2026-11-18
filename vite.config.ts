import { defineConfig, defaultClientConditions } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // history 路由 + SPA 回退要求绝对资源路径（不再支持子目录部署）
  base: '/',
  plugins: [vue()],
  server: {
    watch: {
      // qa/ 是本地测试产物（gitignore）：解压 docx 等操作会短暂锁文件，
      // Windows 上 chokidar 监视到 EBUSY 会直接崩掉 dev server，故排除
      ignored: ['**/qa/**'],
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // onnxruntime-web：改用外部 wasm 入口（ort.min.mjs），wasm 运行时走 CDN，
    // 避免 Vite 把 28MB 的 ort-wasm-*.wasm 复制进构建产物（保留 Vite 默认条件避免误伤其他包）
    conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router'],
        },
      },
    },
  },
})
