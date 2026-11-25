import { useMemo } from 'react'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import { echarts } from '@/lib/echarts-core'
import { useThemeColors } from '@/hooks/use-theme-colors'
import { formatCurrency } from '@/utils/format'

export interface BreakdownSlice {
  label: string
  value: number
  /** Overrides the palette colour (e.g. green for money left over). */
  color?: string
}

// Categorical palette — distinct hues that hold up on both light and dark
// cards. Order is stable so a category keeps its colour as values change.
const PALETTE = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#a855f7', '#f97316', '#64748b']
const MAX_SLICES = 7

/** Largest slices first; everything past `MAX_SLICES` folds into "Others". */
function prepare(slices: BreakdownSlice[]): BreakdownSlice[] {
  const sorted = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
  if (sorted.length <= MAX_SLICES) return sorted
  const head = sorted.slice(0, MAX_SLICES - 1)
  const rest = sorted.slice(MAX_SLICES - 1).reduce((sum, s) => sum + s.value, 0)
  return [...head, { label: 'Others', value: rest }]
}

interface BreakdownPieProps {
  slices: BreakdownSlice[]
  /** Small caption shown under the total in the donut's centre. */
  centerLabel: string
  /** Overrides the centre total (defaults to the sum of the slices). */
  centerValue?: number
}

export function BreakdownPie({ slices, centerLabel, centerValue }: BreakdownPieProps) {
  const colors = useThemeColors()
  const data = useMemo(() => prepare(slices), [slices])
  const total = data.reduce((sum, s) => sum + s.value, 0)

  const option = {
    animation: false,
    tooltip: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['58%', '82%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderRadius: 6, borderColor: colors.popover, borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { disabled: true },
        data: data.map((s, i) => ({ name: s.label, value: s.value, itemStyle: { color: s.color ?? PALETTE[i % PALETTE.length] } })),
      },
    ],
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <ReactEChartsCore echarts={echarts} option={option} style={{ height: 200, width: '100%' }} notMerge />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] text-muted-foreground">{centerLabel}</p>
          <p className="font-numeric text-lg font-semibold text-foreground">{formatCurrency(centerValue ?? total)}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {data.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-foreground">{s.label}</span>
            <span className="text-xs text-muted-foreground">{Math.round((s.value / total) * 100)}%</span>
            <span className="font-numeric w-24 text-right font-medium text-foreground">{formatCurrency(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
