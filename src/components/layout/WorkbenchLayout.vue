<script setup lang="ts">
/**
 * 工作台壳(V1.1):左侧可折叠菜单(240px,sticky 独立滚动) + 右侧 fluid 全宽内容区(R4 不留空)。
 * - 桌面(≥861px):侧栏展开 240px / 收起为 56px rail(常驻 6 个大类图标=入口:点击=展开侧栏+独占展开+路由首位工具);
 * - 侧栏用 v-show 保持挂载:工具间切换(嵌套路由)壳与菜单不重挂载,折叠/过滤/滚动状态天然保持(R1.7);
 * - 移动端(≤860px):侧栏隐藏,菜单走顶栏汉堡抽屉(见 ToolDrawer),内容区全宽。
 */
import { nextTick, ref, watch } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'
import { menuTree } from '@/data/menuTree'
import ToolMenu from '@/components/layout/ToolMenu.vue'
import { useWorkbench } from '@/composables/useWorkbench'
import { useMenuSync } from '@/composables/useMenuSync'
import AppIcon from '@/components/common/AppIcon.vue'

const { sidebarCollapsed } = useWorkbench()
const { request: syncRequest } = useMenuSync()
const router = useRouter()
const toolMenuRef = ref<InstanceType<typeof ToolMenu> | null>(null)

/** rail 图标入口:展开侧栏 + 独占展开该大类 + 路由到首位工具 */
async function railGo(catId: string) {
  sidebarCollapsed.value = false
  await nextTick()
  toolMenuRef.value?.soloOpen(catId)
}

/** 顶栏联动请求到达时,若侧栏处于收起态先展开(菜单的开合态由 ToolMenu 自行施加) */
watch(syncRequest, () => {
  sidebarCollapsed.value = false
})
</script>

<template>
  <div class="workbench" :class="{ collapsed: sidebarCollapsed }">
    <aside v-show="!sidebarCollapsed" class="wb-sidebar">
      <div class="wb-side-bar">
        <span class="wb-side-title">工具菜单</span>
        <button
          class="wb-collapse-btn"
          title="收起菜单(工具面板占满全宽)"
          aria-label="收起菜单"
          @click="sidebarCollapsed = true"
        >
          <PanelLeftClose :size="16" />
        </button>
      </div>
      <div class="wb-menu-scroll">
        <ToolMenu ref="toolMenuRef" />
      </div>
    </aside>

    <!-- 收起态 rail:6 个大类图标 = 快速入口 -->
    <aside v-show="sidebarCollapsed" class="wb-rail">
      <button class="rail-item rail-expand" title="展开菜单" aria-label="展开菜单" @click="sidebarCollapsed = false">
        <PanelLeftOpen :size="17" />
      </button>
      <button
        v-for="c in menuTree"
        :key="c.cat.id"
        class="rail-item"
        :title="c.cat.name + (c.firstTool ? ` · ${c.firstTool.title}` : '')"
        @click="railGo(c.cat.id)"
      >
        <AppIcon :name="c.cat.icon" :size="17" />
      </button>
    </aside>

    <main class="wb-content">
      <RouterView />
      <!-- 收起态左缘悬浮把手:恢复侧栏 -->
      <button
        v-if="sidebarCollapsed"
        class="wb-handle"
        title="展开菜单"
        aria-label="展开菜单"
        @click="sidebarCollapsed = false"
      >
        <PanelLeftOpen :size="15" />
      </button>
    </main>
  </div>
</template>

<style scoped>
.workbench {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  align-items: start;
}
.workbench.collapsed {
  grid-template-columns: 56px minmax(0, 1fr);
}
/* ---------- 侧栏:sticky 跟随 + 独立滚动 ---------- */
.wb-sidebar {
  position: sticky;
  top: 60px; /* 页头高度 */
  height: calc(100dvh - 60px);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-soft) 60%, transparent);
}
.wb-side-bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 8px 16px;
}
.wb-side-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-3);
}
.wb-collapse-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}
.wb-collapse-btn:hover {
  color: var(--text);
  border-color: var(--accent);
}
.wb-menu-scroll {
  /* 高度透传:滚动与底部固定区由 ToolMenu 内部的 .menu-scroll/.menu-foot 自持 */
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* ---------- 收起态 rail ---------- */
.wb-rail {
  position: sticky;
  top: 60px;
  height: calc(100dvh - 60px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-soft) 60%, transparent);
}
.rail-item {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}
.rail-item:hover {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.rail-expand {
  color: var(--text-3);
  border: 1px dashed var(--border-strong);
  margin-bottom: 4px;
}
/* ---------- 内容区:fluid 全宽(R4) ---------- */
.wb-content {
  position: relative;
  min-width: 0;
  padding: 20px 26px 40px;
}
.wb-handle {
  position: absolute;
  top: 14px;
  left: 0;
  display: grid;
  place-items: center;
  width: 26px;
  height: 44px;
  border: 1px solid var(--border);
  border-left: none;
  border-radius: 0 10px 10px 0;
  background: var(--panel-solid);
  color: var(--text-3);
  cursor: pointer;
}
.wb-handle:hover {
  color: var(--accent-text);
  border-color: var(--accent);
}
@media (max-width: 860px) {
  .workbench,
  .workbench.collapsed {
    /* 移动端:菜单走抽屉,内容区单列全宽 */
    display: block;
  }
  .wb-sidebar,
  .wb-rail {
    display: none;
  }
  .wb-content {
    padding: 14px 16px calc(28px + var(--safe-b));
  }
  .wb-handle {
    display: none;
  }
}
</style>
