/** 小游戏分类注册表（V1.2 P0 六款：数独自 utility 迁移升级 + 五款全新），全部本地运行、零依赖、无音效 */
import type { ToolDef } from '@/types'

const tools: ToolDef[] = [
  {
    slug: 'sudoku-solver', title: '数独', category: 'games',
    desc: '4 阶与 9 阶三档唯一解出题：铅笔笔记、错误检查、行列宫高亮、计时与进度续玩，支持导出 Word 题目卡打印。',
    keywords: ['数独', 'sudoku', '九宫格', '填数字', '解谜', '打印数独'],
    component: () => import('./components/SudokuGame.vue'),
  },
  {
    slug: 'gomoku', title: '五子棋', category: 'games',
    desc: '15×15 人机对战（入门/中级/困难三档 AI）与双人同屏，无禁手规则，悔棋与连线高亮，纯本地运行。',
    keywords: ['五子棋', 'gomoku', 'gobang', '连珠', '下棋', '人机对战'],
    component: () => import('./components/GomokuGame.vue'),
  },
  {
    slug: 'snake', title: '贪吃蛇', category: 'games',
    desc: '经典贪吃蛇：方向键/WASD、三档速度、穿墙开关，最高分持久化，Esc 一键暂停适合摸鱼。',
    keywords: ['贪吃蛇', 'snake', '贪食蛇', '吃苹果'],
    component: () => import('./components/SnakeGame.vue'),
  },
  {
    slug: '2048', title: '2048', category: 'games',
    desc: '经典数字合并游戏：方向键滑动合并、撤销一步、最高分与进度自动保存，刷新后继续玩。',
    keywords: ['2048', '数字合并', '合并', '滑动'],
    component: () => import('./components/Game2048.vue'),
  },
  {
    slug: 'minesweeper', title: '扫雷', category: 'games',
    desc: '经典扫雷：初级/中级/高级三档，首次点击必安全，右键插旗，剩余雷数与计时。',
    keywords: ['扫雷', 'minesweeper', '挖雷', 'Windows 扫雷'],
    component: () => import('./components/MinesweeperGame.vue'),
  },
  {
    slug: 'sliding-puzzle', title: '数字华容道', category: 'games',
    desc: '3×3/4×4/5×5 数字滑块：打乱保证可解（奇偶校验），步数计时，键盘点击皆可玩，进度自动保存。',
    keywords: ['华容道', '数字华容道', '滑块', '拼图', '八数码', 'sliding puzzle'],
    component: () => import('./components/SlidingPuzzle.vue'),
  },
]

export default tools
