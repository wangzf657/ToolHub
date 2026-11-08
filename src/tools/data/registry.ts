import type { ToolDef } from '@/types'

/** 数据工具注册表（13 项） */
const tools: ToolDef[] = [
  { slug: 'csv-viewer', title: 'CSV 表格查看器', category: 'data', desc: '粘贴或上传 CSV 立即渲染成可排序表格，自动识别分隔符与引号字段。', keywords: ['csv', '查看', '表格'], component: () => import('./components/CsvViewer.vue'), steps: ['粘贴 CSV 或上传文件', '预览表格数据', '按列排序查看'] },
  { slug: 'excel-to-csv', title: 'Excel 转 CSV', category: 'data', desc: '把 xlsx 工作簿转为 CSV，支持选择工作表，先预览再导出。', keywords: ['excel', 'xlsx', 'csv'], component: () => import('./components/ExcelToCsv.vue') },
  { slug: 'csv-to-excel', title: 'CSV 转 Excel', category: 'data', desc: 'CSV/TSV/JSON 转 xlsx，数字与日期自动识别为真实类型。', keywords: ['csv', 'excel', 'xlsx'], component: () => import('./components/CsvToExcel.vue') },
  { slug: 'chart-from-csv', title: 'CSV 图表生成器', category: 'data', desc: '粘贴 CSV 即刻绘制柱状、折线或饼图，可下载 PNG。', keywords: ['图表', 'chart', '可视化'], component: () => import('./components/ChartFromCsv.vue') },
  { slug: 'compare-csv-files', title: 'CSV 文件对比', category: 'data', desc: '对比两份 CSV/Excel，标出新增、删除与值变化的行，支持大文件。', keywords: ['对比', '差异', 'compare'], component: () => import('./components/CompareCsv.vue') },
  { slug: 'merge-csv-files', title: '合并 CSV 文件', category: 'data', desc: '按表头对齐合并多个 CSV/Excel/JSON，可附加来源文件列。', keywords: ['合并', 'csv', '拼接'], component: () => import('./components/MergeCsv.vue') },
  { slug: 'remove-duplicates-from-csv', title: 'CSV 去重', category: 'data', desc: '按整行或指定列去除重复行，可忽略大小写与首尾空格。', keywords: ['去重', 'csv', '重复'], component: () => import('./components/CsvDedupe.vue') },
  { slug: 'data-analysis-tool', title: '数据分析工作台', category: 'data', desc: '打开 CSV/Excel/JSON/Parquet：筛选、清洗、透视、图表与 SQL 一站完成。', keywords: ['数据分析', '工作台', 'bi'], studio: true, component: () => import('../editors/components/DataStudio.vue'), steps: ['导入 CSV / Excel / JSON 文件', '筛选、排序与透视', '用图表与 SQL 探索，导出结果'] },
  { slug: 'excel-viewer', title: 'Excel 在线预览', category: 'data', desc: '不用装 Office：多 sheet 标签预览 xlsx，单元格点击复制，另存 CSV。', keywords: ['excel', '预览', 'xlsx', '查看'], component: () => import('./components/ExcelViewer.vue'), steps: ['拖入 .xlsx/.xls', '切换 sheet 标签', '点击单元格复制 / 另存 CSV'] },
  { slug: 'query-csv-with-sql', title: 'SQL 查询 CSV', category: 'data', desc: '用 SQL 查询 CSV/Excel/JSON 文件，支持多表 JOIN（本地 alasql 引擎）。', keywords: ['sql', '查询', 'join'], component: () => import('./components/SqlQuery.vue') },
  { slug: 'excel-pivot-table-online', title: '在线数据透视表', category: 'data', desc: '选择行、列与值聚合方式（求和/平均/计数/中位数），生成透视表。', keywords: ['透视表', 'pivot', '汇总'], component: () => import('./components/PivotTable.vue') },
  { slug: 'parquet-to-csv', title: 'Parquet 查看转换', category: 'data', desc: '在浏览器打开 Parquet 文件：查看 schema、浏览行数据并转 CSV/Excel。', keywords: ['parquet', '大数据', '列存'], needModel: true, component: () => import('./components/ParquetViewer.vue') },
  { slug: 'split-csv-file', title: 'CSV 文件拆分', category: 'data', desc: '按行数或按某列取值拆分大 CSV，导出为 CSV/Excel 打包下载。', keywords: ['拆分', 'csv', '分割'], component: () => import('./components/CsvSplitter.vue') },
]

export default tools
