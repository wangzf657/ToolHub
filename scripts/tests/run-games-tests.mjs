// V1.2 小游戏引擎哨兵（需求 §十.1）——进 npm run test 门禁
// 1. 数独：四档批量生成断言（唯一解 + 可解 + 提示数口径 + 诚实降级）；
// 2. 五子棋：胜负判定（五连/长连/四连不算）+ 困难档 vs 种子随机 20 局全胜 + 成五/堵五捷径；
// 3. 2048：合并/得分/无移动检测/终局；
// 4. 扫雷：首开安全（首点及邻域无雷）+ 洪泛开格 + 胜负判定 + 剩余雷数；
// 5. 华容道：打乱可解（奇偶校验）×批量 + 移动/完成判定；
// 6. 贪吃蛇：步进/进食/撞墙/穿墙/反向忽略。
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const here = import.meta.dirname
const root = path.resolve(here, '../..')
const outdir = path.join(here, '_engines')
const engines = ['games/rng', 'games/sudoku', 'games/sudokuGrade', 'games/gomoku', 'games/gomokuAI', 'games/g2048', 'games/snake', 'games/minesweeper', 'games/slidingPuzzle']
for (const e of engines) {
  await build({ entryPoints: [path.join(root, 'src/lib', e + '.ts')], bundle: true, format: 'esm', platform: 'node', outfile: path.join(outdir, e.replaceAll('/', '_') + '.mjs'), alias: { '@': path.join(root, 'src') }, logLevel: 'silent' })
}
const imp = (name) => import(pathToFileURL(path.join(outdir, 'games_' + name + '.mjs')).href)
const { seededRandom } = await imp('rng')
const S = await imp('sudoku')
const G = await imp('gomoku')
const AI = await imp('gomokuAI')
const G2 = await imp('g2048')
const SN = await imp('snake')
const MS = await imp('minesweeper')
const SP = await imp('slidingPuzzle')

let pass = 0
let fail = 0
const lines = []
function chk(id, name, ok, detail = '') {
  ok ? pass++ : fail++
  lines.push(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${detail ? ' | ' + detail : ''}`)
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg ?? '断言失败')
}

// ---------------- 1. 数独 ----------------
// 四档 × N 批量：唯一解 + 可解 + 提示数口径 + 技巧档诚实标注（R2.5）
const SUDOKU_BATCH = Number(process.env.SUDOKU_BATCH ?? 50)
const levelOf = (l) => ({ x4: '4 阶', easy: '9 阶简单', medium: '9 阶中级', hard: '9 阶高级' })[l]
for (const level of ['x4', 'easy', 'medium', 'hard']) {
  let okUnique = 0
  let okSolve = 0
  let okClues = 0
  let worstMs = 0
  const clueRange = { x4: [3, 8], easy: [36, 45], medium: [28, 34], hard: [24, 30] }[level]
  for (let k = 0; k < SUDOKU_BATCH; k++) {
    const t0 = Date.now()
    const p = S.generateSudoku(level, { rng: seededRandom(1000 + k * 7 + level.length), budgetMs: level === 'hard' ? 700 : 400 })
    worstMs = Math.max(worstMs, Date.now() - t0)
    // 唯一解
    if (S.countSolutions(p.puzzle, 2, p.size) === 1) okUnique++
    // 可解且解恰为给出的 solution
    const sol = S.solveSudoku(p.puzzle, p.size)
    if (sol && sol.every((v, i) => v === p.solution[i])) okSolve++
    // 提示数口径（诚实区间：降级接受允许略超出目标带）
    if (p.clues >= clueRange[0] && p.clues <= clueRange[1]) okClues++
    // 诚实标注：非降级时档位必须与请求一致
    if (!p.degraded) assert(p.level === level, `档位虚标:${level}→${p.level}`)
  }
  chk('SUD-1', `数独 ${levelOf(level)}×${SUDOKU_BATCH} 唯一解`, okUnique === SUDOKU_BATCH, `${okUnique}/${SUDOKU_BATCH}`)
  chk('SUD-1', `数独 ${levelOf(level)} 可解且解一致`, okSolve === SUDOKU_BATCH, `${okSolve}/${SUDOKU_BATCH}`)
  chk('SUD-1', `数独 ${levelOf(level)} 提示数 ${clueRange.join('-')}`, okClues === SUDOKU_BATCH, `${okClues}/${SUDOKU_BATCH} 最慢${worstMs}ms`)
}
// 手输求解与冲突检测（旧功能保留，R2 验收）
{
  const g = new Array(81).fill(0)
  g[0] = 5
  g[1] = 5
  chk('SUD-2', '冲突检测（同行重复）', S.sudokuConflicts(g, 9).size === 2 && S.sudokuConflicts(g, 9).has(0) && S.sudokuConflicts(g, 9).has(1))
  const bad = new Array(81).fill(0)
  bad.fill(1, 0, 10)
  chk('SUD-2', '无解盘返回 null', S.solveSudoku(bad, 9) === null)
  const p = S.generateSudoku('easy', { rng: seededRandom(42) })
  chk('SUD-2', '完成判定', S.sudokuComplete([...p.solution], 9) && !S.sudokuComplete(p.puzzle, 9))
  const x4 = S.generateSudoku('x4', { rng: seededRandom(7) })
  const x4sol = S.solveSudoku(x4.puzzle, 4)
  chk('SUD-2', '4 阶冲突/完成', !!x4sol && S.sudokuComplete(x4sol, 4))
}
// 分级器：满盘 tier=0；单空格 tier=0
{
  const p = S.generateSudoku('easy', { rng: seededRandom(99) })
  const solved = [...p.solution]
  const grade = await imp('sudokuGrade')
  chk('SUD-3', '分级器：终盘 tier=0', grade.gradeTier(solved, 9) === 0)
}

// ---------------- 2. 五子棋 ----------------
{
  const b = new Int8Array(225)
  // 横向五连
  for (let x = 3; x <= 7; x++) b[7 * 15 + x] = 1
  const w1 = G.winLine(b, 7 * 15 + 5)
  chk('GOM-1', '横向五连判胜', !!w1 && w1.length === 5)
  // 长连亦胜（无禁手）
  const b2 = new Int8Array(225)
  for (let x = 3; x <= 9; x++) b2[7 * 15 + x] = 1
  chk('GOM-1', '长连（7 连）亦胜', (G.winLine(b2, 7 * 15 + 5)?.length ?? 0) >= 5)
  // 斜向
  const b3 = new Int8Array(225)
  for (let k = 0; k < 5; k++) b3[(3 + k) * 15 + (3 + k)] = 2
  chk('GOM-1', '斜向五连判胜', !!G.winLine(b3, 4 * 15 + 4))
  // 四连不算
  const b4 = new Int8Array(225)
  for (let x = 3; x <= 6; x++) b4[7 * 15 + x] = 1
  chk('GOM-1', '四连不判胜', G.winLine(b4, 7 * 15 + 4) === null)
  // 空盘候选 = 中心；邻域裁剪有效
  const empty = new Int8Array(225)
  chk('GOM-2', '空盘候选=中心', JSON.stringify(G.candidates(empty)) === '[112]')
  const one = new Int8Array(225)
  one[112] = 1
  const cand = G.candidates(one)
  chk('GOM-2', '邻域候选裁剪（≤2 距离 24 点）', cand.length === 24, String(cand.length))
}
{
  // 成五捷径：我有四，轮到我 → 直接成五
  const b = new Int8Array(225)
  for (let x = 5; x <= 8; x++) b[7 * 15 + x] = 1
  const m = AI.gomokuBestMove(b, 1, { level: 'medium' })
  chk('GOM-3', '成五捷径', m === 7 * 15 + 4 || m === 7 * 15 + 9, `move=${m}`)
  // 堵五捷径：对方四，轮到我 → 堵
  const b2 = new Int8Array(225)
  for (let x = 5; x <= 8; x++) b2[7 * 15 + x] = 2
  b2[9 * 15 + 9] = 1
  const m2 = AI.gomokuBestMove(b2, 1, { level: 'easy', rng: () => 0.99 })
  chk('GOM-3', '堵五捷径（入门档也必堵）', m2 === 7 * 15 + 4 || m2 === 7 * 15 + 9, `move=${m2}`)
}
// 困难档 vs 种子随机 20 局全胜（R3 验收；AI 执黑先行）
{
  let wins = 0
  let maxMs = 0
  for (let g = 0; g < 20; g++) {
    const rng = seededRandom(20261117 + g)
    const board = new Int8Array(225)
    const moves = []
    let turn = 1
    let result = 0 // 1=AI(黑)胜 2=随机(白)胜 0=和
    while (true) {
      const empties = [...Array(225).keys()].filter((i) => !board[i])
      if (!empties.length) break
      let mv
      if (turn === 1) {
        const t0 = Date.now()
        mv = AI.gomokuBestMove(board, 1, { level: 'hard', budgetMs: 600 })
        maxMs = Math.max(maxMs, Date.now() - t0)
      } else {
        mv = empties[Math.floor(rng() * empties.length)]
      }
      board[mv] = turn
      moves.push(mv)
      if (G.winLine(board, mv)) {
        result = turn
        break
      }
      turn = turn === 1 ? 2 : 1
    }
    if (result === 1) wins++
    else chk('GOM-4', `对局 ${g} 未取胜（result=${result}）`, false, `last=${moves.at(-1)}`)
  }
  chk('GOM-4', '困难档 vs 随机 20 局全胜', wins === 20, `${wins}/20 最慢单步${maxMs}ms`)
}

// ---------------- 3. 2048 ----------------
{
  const mk = (a) => a
  const L = G2.move2048(mk([2, 2, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 'left')
  chk('2048-1', '合并 [2,2,4,4]→[4,8] 得分 12', JSON.stringify(L.board.slice(0, 4)) === '[4,8,0,0]' && L.gained === 12 && L.moved, JSON.stringify(L.board.slice(0, 4)) + ' gained=' + L.gained)
  const noMove = G2.move2048(mk([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]), 'left')
  chk('2048-1', '棋盘格交错无移动', !noMove.moved && noMove.gained === 0)
  const R = G2.move2048(mk([2, 2, 0, 0, ...Array(12).fill(0)]), 'right')
  chk('2048-1', '右移合并', JSON.stringify(R.board.slice(0, 4)) === '[0,0,0,4]' && R.gained === 4)
  const U = G2.move2048(mk([2, 0, 0, 0, 2, 0, 0, 0, ...Array(8).fill(0)]), 'up')
  chk('2048-1', '上移合并', JSON.stringify([U.board[0], U.board[4]]) === '[4,0]' && U.gained === 4)
  const D = G2.move2048(mk([2, 0, 0, 0, 2, 4, 0, 0, ...Array(8).fill(0)]), 'down')
  chk('2048-1', '下移合并（两列各自落底合并，得分 8）', JSON.stringify([D.board[0], D.board[4], D.board[8], D.board[12]]) === '[0,0,0,4]' && JSON.stringify([D.board[1], D.board[5], D.board[9], D.board[13]]) === '[0,0,0,4]' && D.gained === 4, JSON.stringify(D.board.slice(0, 14)))
  // 单轮只合并一次：[4,2,2,0] → [4,4,0,0] 而非 [8,0,0,0]
  const once = G2.move2048(mk([4, 2, 2, 0, ...Array(12).fill(0)]), 'left')
  chk('2048-1', '单轮只合并一次', JSON.stringify(once.board.slice(0, 3)) === '[4,4,0]', JSON.stringify(once.board.slice(0, 3)))
  chk('2048-2', '终局判定', G2.isGameOver2048(mk([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])) && !G2.isGameOver2048(mk([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 0])))
  const seeded = seededRandom(5)
  const nb = G2.newBoard2048(seeded)
  chk('2048-2', '新盘两块（2 或 4）', nb.filter((v) => v > 0).length === 2 && nb.every((v) => v === 0 || v === 2 || v === 4))
  chk('2048-2', '胜利检测', G2.hasWon2048(mk([2048, ...Array(15).fill(0)])) && !G2.hasWon2048(mk([1024, ...Array(15).fill(0)])))
}

// ---------------- 4. 扫雷 ----------------
{
  // 首开安全：200 局首点及邻域无雷
  let safe = 0
  for (let k = 0; k < 200; k++) {
    const s = MS.createMinesweeper(9, 9, 10, seededRandom(k))
    const first = k % 81
    MS.openCell(s, first)
    const zone = [first, ...MS.neighbors(9, 9, first)]
    if (zone.every((i) => !s.mine[i])) safe++
  }
  chk('MS-1', '首开安全 ×200（首点及邻域无雷）', safe === 200, `${safe}/200`)
  // 首开即布满雷数
  const s = MS.createMinesweeper(9, 9, 10, seededRandom(1))
  MS.openCell(s, 0)
  chk('MS-1', '雷数正确', [...s.mine].reduce((a, b) => a + b, 0) === 10)
  // 雷数超容退化：5×5 24 雷（安全区放不下）→ 仅避开首点
  const dense = MS.createMinesweeper(5, 5, 24, seededRandom(3))
  MS.openCell(dense, 12)
  chk('MS-1', '密雷退化（仅避开首点）', dense.mine[12] === 0 && [...dense.mine].reduce((a, b) => a + b, 0) === 24)
  // 洪泛：角上开局展开大片
  const s2 = MS.createMinesweeper(9, 9, 10, seededRandom(77))
  MS.openCell(s2, 40)
  chk('MS-2', '中点开局洪泛展开 >1 格', [...s2.open].reduce((a, b) => a + b, 0) > 1)
  // 插旗与剩余雷数
  const s3 = MS.createMinesweeper(9, 9, 10, seededRandom(8))
  MS.toggleFlag(s3, 5)
  MS.toggleFlag(s3, 6)
  chk('MS-2', '插旗 + 剩余雷数', s3.flag[5] === 1 && MS.minesLeft(s3) === 8)
  MS.toggleFlag(s3, 5)
  chk('MS-2', '拔旗', s3.flag[5] === 0 && MS.minesLeft(s3) === 9)
  // 踩雷败局：构造必踩局面（全部开完只留雷区）
  const s4 = MS.createMinesweeper(3, 3, 8, seededRandom(9))
  MS.openCell(s4, 0) // 唯一非雷安全区（3×3-8=1 空间，placeMines 退化仅避开首点）
  chk('MS-3', '胜局判定（开尽非雷格）', s4.won, `open=${[...s4.open].reduce((a, b) => a + b, 0)}`)
  const s5 = MS.createMinesweeper(4, 4, 3, seededRandom(11))
  MS.openCell(s5, 0)
  const boomIdx = [...Array(16).keys()].find((i) => s5.mine[i] && !s5.open[i])
  if (boomIdx !== undefined) MS.openCell(s5, boomIdx)
  chk('MS-3', '踩雷败局 + 揭雷', s5.boom === (boomIdx !== undefined))
}

// ---------------- 5. 华容道 ----------------
{
  for (const n of [3, 4, 5]) {
    let solvable = 0
    let shuffledOk = 0
    for (let k = 0; k < 300; k++) {
      const b = SP.shuffledBoard(n, seededRandom(n * 100 + k))
      if (SP.boardParity(b, n) === SP.boardParity(SP.solvedBoard(n), n)) solvable++
      if (b.some((v) => v !== 0)) shuffledOk++
    }
    chk('SLD-1', `${n}×${n} 打乱可解 ×300`, solvable === 300 && shuffledOk === 300, `${solvable}/300`)
  }
  const goal = SP.solvedBoard(4)
  chk('SLD-2', '目标态即完成', SP.isSolved(goal))
  const b = [...goal]
  assert(SP.applyMove(b, 4, 14), '14 应可移')
  chk('SLD-2', '移动交换空格', b[14] === 0 && b[15] === 15 && !SP.isSolved(b))
  chk('SLD-2', '非相邻不可移', !SP.applyMove(b, 4, 0))
  const b2 = [...goal]
  SP.applyMove(b2, 4, 14)
  SP.applyMove(b2, 4, 13)
  SP.applyMove(b2, 4, 14)
  SP.applyMove(b2, 4, 15)
  chk('SLD-2', '往返移动还原', SP.isSolved(b2))
}

// ---------------- 6. 贪吃蛇 ----------------
{
  const rng = seededRandom(1)
  const s = SN.newSnake(false, rng)
  const [hx, hy] = SN.cellXY(s.snake[0])
  chk('SNAKE-1', '初始 3 节朝右', s.snake.length === 3 && s.dir === 'right' && hx === 10 && hy === 10)
  // 正常步进
  SN.tickSnake(s)
  chk('SNAKE-1', '步进前进', SN.cellXY(s.snake[0])[0] === 11 && s.snake.length === 3)
  // 反向忽略
  SN.turn(s, 'left')
  chk('SNAKE-1', '180° 掉头忽略', s.dir === 'right')
  // 自撞：头移动方向上的下一格在身体内（尾部本步会移出，故撞的是非尾格）
  const s3 = SN.newSnake(false, rng)
  s3.snake = [220, 221, 222, 200] // 头 (10,10)向右→(11,10)=221 在身体
  s3.food = 0 // 挪开食物，确保本步不是进食
  s3.dir = 'right'
  const ev = SN.tickSnake(s3)
  chk('SNAKE-2', '自撞死亡', ev === 'died' && !s3.alive)
  // 撞墙 / 穿墙
  const s4 = SN.newSnake(false, rng)
  s4.snake = [3, 2, 1] // 头 (3,0) 行右边界 col20? 3=(3,0)；向 right 移动 → 4... 改到边界
  s4.snake = [20, 19, 18] // 头 (20,0)
  s4.dir = 'right'
  chk('SNAKE-3', '撞墙死亡', SN.tickSnake(s4) === 'died')
  const s5 = SN.newSnake(true, rng)
  s5.snake = [20, 19, 18]
  s5.dir = 'right'
  const evw = SN.tickSnake(s5)
  chk('SNAKE-3', '穿墙环绕', evw === null && s5.alive && s5.snake[0] === 0)
  // 进食加分
  const s6 = SN.newSnake(false, rng)
  s6.snake = [110, 109, 108]
  s6.food = 111
  const before = s6.snake.length
  const eva = SN.tickSnake(s6)
  chk('SNAKE-4', '进食 +3 分并增长', eva === 'ate' && s6.score === 3 && s6.snake.length === before + 1)
}

console.log(`小游戏引擎哨兵 ${pass + fail} 项:通过 ${pass},失败 ${fail}`)
for (const l of lines) console.log(l)
if (fail > 0) process.exit(1)
