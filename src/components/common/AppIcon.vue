<script setup lang="ts">
import { computed } from 'vue'
import {
  Image as ImageIcon, Video, Music, FileText, Database, Wrench, Code2, TrendingUp,
  Building2, Search, BrainCircuit, PenTool, Lock, Zap, WifiOff, Infinity as InfinityIcon,
  Star, Upload, Download, Copy, Check, X, Menu, Sun, Moon, ChevronRight, FileUp,
  Loader2, Play, Pause, RotateCw, Trash2, Plus, Minus, RefreshCw, Settings2, Info,
  AlertTriangle, CheckCircle2, Grid3X3, Layers, Square, Scissors, Type as TypeIcon,
} from 'lucide-vue-next'

const props = defineProps<{ name: string; size?: number | string }>()

const map: Record<string, unknown> = {
  image: ImageIcon, video: Video, audio: Music, pdf: FileText, data: Database,
  utility: Wrench, code: Code2, finance: TrendingUp, business: Building2, seo: Search,
  ai: BrainCircuit, studio: PenTool, lock: Lock, zap: Zap, 'wifi-off': WifiOff,
  infinity: InfinityIcon, star: Star, upload: Upload, download: Download, copy: Copy,
  check: Check, x: X, menu: Menu, sun: Sun, moon: Moon, 'chevron-right': ChevronRight,
  'file-up': FileUp, loader: Loader2, play: Play, pause: Pause, rotate: RotateCw,
  trash: Trash2, plus: Plus, minus: Minus, refresh: RefreshCw, settings: Settings2,
  info: Info, warn: AlertTriangle, 'check-circle': CheckCircle2, grid: Grid3X3,
  layers: Layers, square: Square, scissors: Scissors, text: TypeIcon,
}

const comp = computed(() => map[props.name] ?? Info)
</script>

<template>
  <component :is="comp" :size="size ?? 18" :stroke-width="2" />
</template>
