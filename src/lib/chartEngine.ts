/** 图表引擎：Chart.js 懒加载包装 */

let chartJsPromise: Promise<typeof import('chart.js')> | null = null

async function getChartJs() {
  if (!chartJsPromise) {
    chartJsPromise = import('chart.js').then((m) => {
      m.Chart.register(
        m.ArcElement,
        m.LineElement,
        m.BarElement,
        m.PointElement,
        m.BarController,
        m.LineController,
        m.PieController,
        m.DoughnutController,
        m.CategoryScale,
        m.LinearScale,
        m.Legend,
        m.Tooltip,
        m.Title,
      )
      return m
    })
  }
  return chartJsPromise
}

export type ChartKind = 'bar' | 'line' | 'pie' | 'doughnut'

export function renderChart(
  canvas: HTMLCanvasElement,
  kind: ChartKind,
  labels: string[],
  series: { label: string; data: number[] }[],
  opts: { horizontal?: boolean; colors?: string[]; legend?: boolean } = {},
): () => void {
  let disposed = false
  let cleanup = () => {}
  void getChartJs().then(({ Chart }) => {
    if (disposed) return
    const palette = opts.colors ?? ['#6366f1', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#a78bfa', '#fb923c', '#2dd4bf']
    const styles = getComputedStyle(document.documentElement)
    const textColor = styles.getPropertyValue('--text-2').trim() || '#94a3b8'
    const gridColor = styles.getPropertyValue('--border').trim() || 'rgba(148,163,205,.15)'
    const chart = new Chart(canvas, {
      type: kind,
      data: {
        labels,
        datasets: series.map((s, i) => ({
          label: s.label,
          data: s.data,
          backgroundColor:
            kind === 'line'
              ? palette[i % palette.length] + '33'
              : palette.map((c) => c + 'cc'),
          borderColor: kind === 'line' ? palette[i % palette.length] : palette.map((c) => c),
          borderWidth: 2,
          tension: 0.3,
          fill: kind === 'line',
          pointRadius: 3,
        })),
      },
      options: {
        indexAxis: opts.horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: opts.legend ?? series.length > 1, labels: { color: textColor } },
        },
        scales:
          kind === 'pie' || kind === 'doughnut'
            ? undefined
            : {
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
                y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true },
              },
      },
    })
    cleanup = () => chart.destroy()
  })
  return () => {
    disposed = true
    cleanup()
  }
}
