<script setup lang="ts">
/**
 * 工作台菜单(V1.1):基于 Element Plus el-menu 体系——
 * el-sub-menu=菜单大类(6,可折叠) / el-menu-item-group=领域族小标题(77,固定展开) / el-menu-item=工具(511)。
 * 关键交互(设计文档 §3.4):
 * - 大类头双语义:标题主体点击=独占展开该类+路由到类内第一个工具+清空过滤;chevron/空白区=普通折叠切换;
 * - 默认仅当前大类展开(localStorage 记忆 toolhub.menuCollapsed,当前类强制展开优先于记忆;外部直达不折叠其他类);
 * - 过滤框就地按 工具名/关键词/slug/领域族名 匹配(口径与 SearchModal 一致),命中族名显示整族,过滤态自动展开匹配大类;
 * - 族索引弹层(仅桌面):大类头右端图标弹出该类族目录,点击滚动定位+闪烁高亮;
 * - 吸顶链:过滤框/大类头/当前族小标题在侧栏滚动容器内分层 sticky。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ElMenu, ElSubMenu, ElMenuItem, ElMenuItemGroup, ElPopover } from 'element-plus'
import type { MenuInstance, PopoverInstance } from 'element-plus'
import 'element-plus/es/components/menu/style/css'
import 'element-plus/es/components/popover/style/css'
import { Search as SearchIcon, X, ListTree, ChevronsUpDown, Star, LayoutGrid } from 'lucide-vue-next'
import { menuTree, menuCategoryOfSlug, menuGroupOfSlug } from '@/data/menuTree'
import type { MenuCategoryNode } from '@/data/menuTree'
import type { MenuGroupDef } from '@/data/menuGroups'
import type { ToolDef } from '@/types'
import { readMenuCollapsed, writeMenuCollapsed } from '@/composables/useWorkbench'
import { useMenuSync } from '@/composables/useMenuSync'
import type { MenuSyncRequest } from '@/composables/useMenuSync'

const props = withDefaults(defineProps<{ mobile?: boolean }>(), { mobile: false })

const route = useRoute()
const router = useRouter()
const menuRef = ref<MenuInstance>()
const rootEl = ref<HTMLElement | null>(null)
const allCatIds = menuTree.map((c) => c.cat.id)
const { request: syncRequest, consumedNonce } = useMenuSync()

/** 当前路由对应的菜单大类(工具页有;/tools?cat= 目录页同样以该大类为当前类——强制展开) */
const currentCat = computed(() => {
  if (route.name === 'tool') {
    const slug = String(route.params.slug ?? '')
    return slug ? menuCategoryOfSlug(slug) : undefined
  }
  if (route.name === 'all-tools') {
    const mc = String(route.query.cat ?? '')
    return menuTree.find((c) => c.cat.id === mc)
  }
  return undefined
})

// ---------- 折叠状态(受控 opened) ----------
const openedIds = ref<string[]>([])
const storeLoaded = ref(false)

function persist() {
  if (!storeLoaded.value) return
  writeMenuCollapsed(allCatIds.filter((id) => !openedIds.value.includes(id)))
}

function applyOpen(id: string) {
  if (!openedIds.value.includes(id)) {
    openedIds.value = [id, ...openedIds.value]
    persist()
  }
}
function applyClose(id: string) {
  openedIds.value = openedIds.value.filter((x) => x !== id)
  persist()
}
/** 用 menu.open/close 撑开/收起 EP 内部态,并同步本地数组 */
function openCat(id: string) {
  menuRef.value?.open(id)
  applyOpen(id)
}
function closeCat(id: string) {
  menuRef.value?.close(id)
  applyClose(id)
}

onMounted(() => {
  const collapsedStored = readMenuCollapsed()
  const fresh = localStorageNeverTouched()
  const cur = currentCat.value?.cat.id
  let initOpened: string[]
  if (fresh) {
    // 初次到访:默认仅当前大类展开(无当前类时展开第一个大类)
    initOpened = [cur ?? allCatIds[0]]
  } else {
    initOpened = allCatIds.filter((id) => !collapsedStored.includes(id))
    if (cur && !initOpened.includes(cur)) initOpened = [...initOpened, cur]
    if (!initOpened.length) initOpened = [allCatIds[0]]
  }
  // el-menu 挂载后用 open() 撑开初始集(default-openeds 仅在挂载时读取,此时序更可控)
  for (const id of initOpened) menuRef.value?.open(id)
  openedIds.value = initOpened
  storeLoaded.value = true
  // 挂载晚于联动请求的实例(如从首页点顶栏大类后工作台才挂载)补消费一次
  if (syncRequest.value && syncRequest.value.nonce > consumedNonce.value) applySync(syncRequest.value)
  // 首入定位当前工具
  void nextTick(() => scrollActiveIntoView())
})

/** localStorage 无该 key 视为初次到访(隐私模式读失败同样按初次处理) */
function localStorageNeverTouched() {
  try {
    return localStorage.getItem('toolhub.menuCollapsed') === null
  } catch {
    return true
  }
}

/** 路由切换:只强制展开当前大类,不折叠其他类(独占仅发生在入口点击) */
watch(
  () => route.fullPath,
  async () => {
    const cur = currentCat.value?.cat.id
    if (cur && !openedIds.value.includes(cur)) openCat(cur)
    await nextTick()
    scrollActiveIntoView()
  },
)

function scrollActiveIntoView() {
  const el = rootEl.value?.querySelector('.el-menu-item.is-active')
  el?.scrollIntoView({ block: 'nearest' })
}

/** 独占展开:折叠其他大类 + 展开目标 + 清空过滤(不路由——路由由调用方决定) */
function applySolo(catId: string) {
  for (const id of [...openedIds.value]) if (id !== catId) closeCat(id)
  if (!openedIds.value.includes(catId)) openCat(catId)
  query.value = ''
}

/** 大类头主体点击:独占展开 + 路由到类内第一个工具 + 清空过滤 */
function soloEnter(c: { cat: { id: string }; firstTool?: ToolDef }) {
  applySolo(c.cat.id)
  if (c.firstTool) router.push(`/t/${c.firstTool.slug}`)
}

// ---------- 顶栏联动(顶栏大类=菜单独占展开;「全部工具」=全部展开) ----------
function applySync(r: MenuSyncRequest) {
  // 先清过滤:等「过滤恢复」watcher 按 preFilterOpened 对齐完成后,再施加联动开合态(否则会被恢复逻辑覆盖)
  query.value = ''
  void nextTick(() => {
    if (r.kind === 'all') {
      for (const id of allCatIds) if (!openedIds.value.includes(id)) openCat(id)
    } else if (r.catId) {
      applySolo(r.catId)
    }
    consumedNonce.value = r.nonce
  })
}
watch(syncRequest, (r) => {
  if (r && r.nonce > consumedNonce.value) applySync(r)
})

/** 全部折叠/展开一键(全折=6 行大类索引) */
const allFolded = computed(() => openedIds.value.length === 0)
function toggleAll() {
  if (allFolded.value) for (const id of allCatIds) openCat(id)
  else for (const id of [...openedIds.value]) closeCat(id)
}

// ---------- 过滤(工具名/关键词/slug/族名,口径与 SearchModal 一致) ----------
const query = ref('')
const preFilterOpened = ref<string[]>([])

const filtering = computed(() => query.value.trim() !== '')

function matchTool(t: ToolDef, q: string) {
  return (
    t.title.toLowerCase().includes(q) ||
    t.slug.includes(q) ||
    (t.keywords ?? []).some((k) => k.toLowerCase().includes(q))
  )
}

/** 过滤视图:命中工具单独显示;命中族名显示整族;无匹配大类整类隐藏。
 *  大类 el-sub-menu 永不因过滤卸载(hidden 用 v-show)——EP 的 open 状态依赖组件注册表,
 *  大量卸载/重挂会造成 openedMenus 与本地 openedIds 漂移(实测 open() 调用不生效)。 */
interface DispGroup {
  group: MenuGroupDef
  tools: ToolDef[]
  anchorId: string
}
interface DispCat {
  cat: MenuCategoryNode['cat']
  groups: DispGroup[]
  firstTool: ToolDef | undefined
  toolCount: number
  /** 过滤态下无匹配,整个大类隐藏(v-show,不卸载) */
  hidden: boolean
}
const displayTree = computed<DispCat[]>(() => {
  if (!filtering.value) {
    return menuTree.map((c) => ({
      cat: c.cat,
      groups: c.groups.map((g) => ({ group: g.group, tools: g.tools, anchorId: g.anchorId })),
      firstTool: c.firstTool,
      toolCount: c.toolCount,
      hidden: false,
    }))
  }
  const q = query.value.trim().toLowerCase()
  return menuTree.map((c) => {
    const groups: DispGroup[] = []
    for (const g of c.groups) {
      if (g.group.name.toLowerCase().includes(q)) groups.push({ group: g.group, tools: g.tools, anchorId: g.anchorId })
      else {
        const tools = g.tools.filter((t) => matchTool(t, q))
        if (tools.length) groups.push({ group: g.group, tools, anchorId: g.anchorId })
      }
    }
    return { cat: c.cat, groups, firstTool: c.firstTool, toolCount: c.toolCount, hidden: groups.length === 0 }
  })
})
const visibleCount = computed(() => displayTree.value.reduce((n, c) => n + (c.hidden ? 0 : c.groups.reduce((m, g) => m + g.tools.length, 0)), 0))

/** 过滤态:自动展开有匹配的大类(覆盖折叠态);清空恢复过滤前状态 */
watch(filtering, (on) => {
  if (on) {
    preFilterOpened.value = [...openedIds.value]
    for (const c of displayTree.value) if (!c.hidden && !openedIds.value.includes(c.cat.id)) openCat(c.cat.id)
  } else {
    // 双向对齐恢复(过滤用 v-show 隐藏大类,组件常驻,EP open/close 状态稳定)
    const target = new Set(preFilterOpened.value)
    for (const id of allCatIds) {
      if (target.has(id) && !openedIds.value.includes(id)) openCat(id)
      else if (!target.has(id) && openedIds.value.includes(id)) closeCat(id)
    }
  }
})
watch(query, () => {
  if (filtering.value) for (const c of displayTree.value) if (!c.hidden && !openedIds.value.includes(c.cat.id)) openCat(c.cat.id)
})

// ---------- 族索引弹层(仅桌面;移动端族定位只走过滤框) ----------
const familyQuery = ref('')
const popoverRefs = new Map<string, PopoverInstance>()
const flashGroupId = ref('')

function setPopoverRef(id: string, el: unknown) {
  if (el) popoverRefs.set(id, el as PopoverInstance)
  else popoverRefs.delete(id)
}

function famList(c: { groups: DispGroup[] }) {
  const q = familyQuery.value.trim().toLowerCase()
  if (!q) return c.groups
  return c.groups.filter((g) => g.group.name.toLowerCase().includes(q))
}

/** 点击族项:关弹层 + 滚动定位到族小标题 + 闪烁高亮 */
function locate(c: { cat: { id: string } }, g: { group: MenuGroupDef; anchorId: string }) {
  popoverRefs.get(c.cat.id)?.hide()
  if (!openedIds.value.includes(c.cat.id)) openCat(c.cat.id)
  void nextTick(() => {
    const el = document.getElementById(g.anchorId)
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    flashGroupId.value = g.group.id
    setTimeout(() => {
      if (flashGroupId.value === g.group.id) flashGroupId.value = ''
    }, 900)
  })
}

// 对外能力(供壳层 rail / 收起把手调用)
defineExpose({
  soloOpen(catId: string) {
    const c = menuTree.find((x) => x.cat.id === catId)
    if (c) soloEnter(c)
  },
  clearFilter() {
    query.value = ''
  },
})
</script>

<template>
  <div ref="rootEl" class="tool-menu" :class="{ mobile: props.mobile }">
    <!-- 滚动区(自持 100% 高):过滤条一级吸顶 + 菜单本体;底部固定区吸附在侧栏/抽屉底缘 -->
    <div class="menu-scroll">
    <!-- 过滤框 + 全部折叠/展开(侧栏滚动容器内一级吸顶) -->
    <div class="menu-toolbar">
      <div class="menu-filter">
        <SearchIcon :size="14" class="filter-glyph" />
        <input
          v-model="query"
          type="text"
          class="filter-input"
          placeholder="过滤工具 / 领域族…"
          aria-label="过滤菜单"
        />
        <button v-if="query" class="filter-clear" aria-label="清空过滤" @click="query = ''">
          <X :size="13" />
        </button>
      </div>
      <button class="fold-all-btn" :title="allFolded ? '展开全部大类' : '折叠全部大类'" @click="toggleAll">
        <ChevronsUpDown :size="14" />
        <span>{{ allFolded ? '展开' : '折叠' }}</span>
      </button>
    </div>

    <el-menu
      ref="menuRef"
      class="tm-el-menu"
      :default-active="route.path"
      @open="applyOpen"
      @close="applyClose"
    >
      <el-sub-menu v-for="c in displayTree" :key="c.cat.id" v-show="!c.hidden" :index="c.cat.id" popper-class="tm-popper">
        <template #title>
          <!-- 主体点击=独占展开+路由首位工具(@click.stop 阻断 EP 默认的标题折叠);chevron/空白区=普通折叠切换 -->
          <div class="cat-title" @click.stop="soloEnter(c)">
            <RouterLink
              :to="c.firstTool ? `/t/${c.firstTool.slug}` : '/tools'"
              class="cat-link"
              :title="`进入${c.cat.name}`"
            >
              <span class="cat-name">{{ c.cat.name }}</span>
              <span class="cat-count">{{ c.toolCount }}</span>
            </RouterLink>
            <el-popover
              v-if="!props.mobile && openedIds.includes(c.cat.id)"
              :ref="(el: unknown) => setPopoverRef(c.cat.id, el)"
              placement="right-start"
              :width="248"
              trigger="click"
              :show-arrow="false"
              popper-class="family-pop"
              @show="familyQuery = ''"
            >
              <template #reference>
                <button class="family-btn" title="族索引" aria-label="打开族索引" @click.stop>
                  <ListTree :size="13" />
                </button>
              </template>
              <div class="family-index">
                <p class="family-head">{{ c.cat.name }} · {{ c.groups.length }} 个领域族</p>
                <input v-model="familyQuery" type="text" class="family-input" placeholder="过滤领域族…" />
                <div class="family-list">
                  <button v-for="g in famList(c)" :key="g.group.id" class="family-item" @click="locate(c, g)">
                    <span>{{ g.group.name }}</span>
                    <span class="family-count">{{ g.tools.length }}</span>
                  </button>
                  <p v-if="!famList(c).length" class="family-empty">无匹配领域族</p>
                </div>
              </div>
            </el-popover>
          </div>
        </template>

        <el-menu-item-group
          v-for="g in c.groups"
          :key="g.group.id"
          :class="{ 'cur-group': currentCat?.cat.id === c.cat.id && menuGroupOfSlug(String(route.params.slug ?? ''))?.group.id === g.group.id }"
        >
          <template #title>
            <RouterLink
              :id="g.anchorId"
              :to="`/t/${g.tools[0].slug}`"
              class="group-link"
              :class="{ flash: flashGroupId === g.group.id }"
              :title="`进入${g.group.name}族第一个工具`"
            >
              <span class="group-tick" aria-hidden="true"></span>
              <span class="group-name">{{ g.group.name }}</span>
              <span class="group-count">{{ g.tools.length }}</span>
            </RouterLink>
          </template>
          <el-menu-item v-for="t in g.tools" :key="t.slug" :index="`/t/${t.slug}`" :title="t.title">
            <RouterLink :to="`/t/${t.slug}`" class="mi-link">{{ t.title }}</RouterLink>
          </el-menu-item>
        </el-menu-item-group>
      </el-sub-menu>
    </el-menu>

    <p v-if="filtering && visibleCount === 0" class="no-match">没有匹配「{{ query }}」的工具或领域族</p>
    </div>

    <!-- 侧栏底部固定区(吸附底缘,不随菜单滚动) -->
    <div class="menu-foot">
      <RouterLink to="/saved" class="foot-link"><Star :size="14" /> 我的收藏</RouterLink>
      <RouterLink to="/tools" class="foot-link"><LayoutGrid :size="14" /> 全部工具</RouterLink>
    </div>
  </div>
</template>

<style>
/* Element Plus 菜单贴合站点视觉(明暗主题都走站点令牌;弹层 teleport 到 body 需全局样式) */
.tm-el-menu.el-menu {
  --el-menu-bg-color: transparent;
  --el-menu-text-color: var(--text-2);
  --el-menu-active-color: var(--accent-text);
  --el-menu-hover-bg-color: var(--accent-soft);
  border: none;
  padding: 4px 8px 8px;
  background: transparent;
}
.tm-el-menu .el-menu-item,
.tm-el-menu .el-sub-menu__title {
  height: 34px;
  line-height: 34px;
}
.tm-el-menu .el-sub-menu__title {
  padding: 0 8px !important;
  background: transparent;
}
.tm-el-menu .el-menu-item {
  padding: 0 6px 0 20px !important;
  min-width: 0;
}
.tm-el-menu .el-menu-item:hover {
  background: var(--accent-soft);
}
.tm-el-menu .el-menu-item.is-active {
  color: var(--accent-text);
}
.tm-el-menu .el-menu--inline {
  --el-menu-bg-color: transparent;
}
.tm-el-menu .el-menu-item-group__title {
  padding: 0;
  line-height: 1;
}
.tm-el-menu .el-menu-item-group > ul {
  padding: 0;
}
/* 族索引弹层(family-pop 为 teleport 到 body 的 popper 类名) */
.family-pop.el-popper {
  background: var(--panel-solid);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow);
}
</style>

<style scoped>
.tool-menu {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  font-size: 13.5px;
}
/* 滚动区:菜单高度撑满侧栏/抽屉(滚动发生在本层,底部固定区得以吸附底缘) */
.menu-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
/* ---------- 工具条(一级吸顶) ---------- */
.menu-toolbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  gap: 6px;
  padding: 10px 10px 8px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.menu-filter {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px;
  border-radius: 9px;
  border: 1px solid var(--border-strong);
  background: color-mix(in srgb, var(--panel-solid) 70%, transparent);
}
.menu-filter:focus-within {
  border-color: var(--accent);
}
.filter-glyph {
  flex: none;
  color: var(--text-3);
}
.filter-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: none;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
}
.filter-clear {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 3px;
}
.fold-all-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 9px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-3);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.fold-all-btn:hover {
  color: var(--text);
  border-color: var(--accent);
}
/* ---------- 大类头(二级吸顶) ---------- */
.cat-title {
  display: flex;
  align-items: center;
  /* 右侧留出空白区+chevron 作为普通折叠热区(点击不冒泡到主体导航) */
  width: calc(100% - 30px);
  min-width: 0;
}
.cat-link {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text);
  text-decoration: none !important;
}
.cat-link:hover .cat-name {
  color: var(--accent-text);
}
.cat-name {
  font-weight: 600;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cat-count {
  flex: none;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-3);
  background: color-mix(in srgb, var(--text-3) 14%, transparent);
  border-radius: 999px;
  padding: 1px 6px;
}
.family-btn {
  flex: none;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}
.family-btn:hover {
  color: var(--accent-text);
  background: var(--accent-soft);
}
/* EP 大类头吸顶(在其所属 sub-menu 展开范围内生效) */
.tool-menu :deep(.el-sub-menu .el-sub-menu__title) {
  position: sticky;
  top: 50px;
  z-index: 20;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
/* ---------- 族小标题:居左分组头样式(强调色小竖标 + 小号加重字,不再像可点子菜单项) ---------- */
.group-link {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 11px 8px 4px 12px;
  scroll-margin-top: 96px;
  color: var(--text-3);
  text-decoration: none !important;
}
.group-tick {
  flex: none;
  width: 3px;
  height: 11px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--accent) 55%, transparent);
}
.group-link:hover .group-tick {
  background: var(--accent);
}
.group-link:hover .group-name {
  color: var(--accent-text);
}
.group-name {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.group-count {
  flex: none;
  font-size: 10px;
  color: color-mix(in srgb, var(--text-3) 72%, transparent);
}
/* 当前族三级吸顶:与 EP 冲突已实测(子菜单内联 ul 在过渡期 overflow:hidden 会捕获 sticky 上下文,
   强行 overflow:visible 会卡死 ElCollapseTransition 的 transitionend 回调)——按设计文档 §3.4
   预授权降级为「仅大类头吸顶」;cur-group 类保留用于族高亮定位与后续升级 */
.tool-menu :deep(.cur-group .el-menu-item-group__title) {
  background: transparent;
}
/* 闪烁高亮(族定位反馈,约 0.8s) */
.group-link.flash {
  animation: groupFlash 0.85s ease;
}
@keyframes groupFlash {
  0%,
  60% {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  100% {
    background: transparent;
  }
}
/* ---------- 工具项 ---------- */
.mi-link {
  display: block;
  width: 100%;
  min-width: 0;
  color: inherit;
  text-decoration: none !important;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.no-match {
  padding: 18px 14px;
  color: var(--text-3);
  font-size: 12.5px;
}
/* ---------- 底部固定区(flex 列尾,吸附侧栏/抽屉底缘) ---------- */
.menu-foot {
  flex: none;
  display: flex;
  gap: 6px;
  padding: 10px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}
.foot-link {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 0;
  border-radius: 9px;
  border: 1px solid var(--border);
  color: var(--text-2);
  font-size: 12.5px;
  text-decoration: none !important;
}
.foot-link:hover {
  color: var(--accent-text);
  border-color: var(--accent);
}
/* 移动端(抽屉内)更紧凑;输入 ≥16px 防 iOS 聚焦缩放(R5-a 口径同样适用于菜单过滤框) */
.tool-menu.mobile .menu-toolbar {
  padding: 10px 12px 8px;
}
@media (max-width: 860px) {
  .filter-input {
    font-size: 16px;
  }
}
.tool-menu.mobile .mi-link {
  font-size: 14px;
}
.tool-menu.mobile :deep(.el-menu-item),
.tool-menu.mobile :deep(.el-sub-menu__title) {
  height: 40px;
  line-height: 40px;
}
</style>

<style>
/* 族索引弹层内容(teleport 到 body,需全局) */
.family-index .family-head {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-3);
}
.family-index .family-input {
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: none;
  color: var(--text);
  font-size: 12.5px;
  outline: none;
  margin-bottom: 6px;
}
.family-index .family-input:focus {
  border-color: var(--accent);
}
.family-index .family-list {
  max-height: 300px;
  overflow-y: auto;
  display: grid;
  gap: 2px;
}
.family-index .family-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 9px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.family-index .family-item:hover {
  background: var(--accent-soft);
}
.family-index .family-count {
  color: var(--text-3);
  font-size: 11px;
}
.family-index .family-empty {
  padding: 10px;
  text-align: center;
  color: var(--text-3);
  font-size: 12px;
  margin: 0;
}
</style>
