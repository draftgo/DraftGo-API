/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMemo } from 'react'
import { Activity, Gauge, RadioTower, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import {
  formatLatency,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import type { PricingModel } from '../types'
import {
  getAvailabilityConfig,
  type ModelPerfBadgeData,
} from './model-perf-badge'

export interface ModelHealthBoardProps {
  models: PricingModel[]
  perfMap: Map<string, ModelPerfBadgeData>
  onModelClick: (modelName: string) => void
}

function statusRank(status: string | undefined): number {
  switch (status) {
    case 'down':
      return 0
    case 'degraded':
      return 1
    case 'stale':
      return 2
    case 'warning':
      return 3
    case 'unknown':
      return 4
    case 'healthy':
      return 5
    default:
      return 6
  }
}

export function ModelHealthBoard(props: ModelHealthBoardProps) {
  const { t } = useTranslation()

  const rows = useMemo(() => {
    return props.models
      .map((model) => ({
        model,
        perf: props.perfMap.get(model.model_name),
      }))
      .sort((a, b) => {
        const rank =
          statusRank(a.perf?.availability_status) -
          statusRank(b.perf?.availability_status)
        if (rank !== 0) return rank
        const aPct = a.perf?.availability_pct ?? -1
        const bPct = b.perf?.availability_pct ?? -1
        if (aPct !== bPct) return aPct - bPct
        return a.model.model_name.localeCompare(b.model.model_name)
      })
  }, [props.models, props.perfMap])

  const totals = useMemo(() => {
    let healthy = 0
    let attention = 0
    let down = 0
    for (const row of rows) {
      const status = row.perf?.availability_status
      if (status === 'healthy') healthy++
      else if (status === 'down') down++
      else attention++
    }
    return { healthy, attention, down }
  }, [rows])

  return (
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-3'>
        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <Activity className='size-4 text-emerald-500' />
            {t('Healthy models')}
          </div>
          <div className='mt-2 text-2xl font-semibold tabular-nums'>
            {totals.healthy}
          </div>
        </div>
        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <Gauge className='size-4 text-amber-500' />
            {t('Needs attention')}
          </div>
          <div className='mt-2 text-2xl font-semibold tabular-nums'>
            {totals.attention}
          </div>
        </div>
        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <RadioTower className='size-4 text-red-500' />
            {t('Unavailable models')}
          </div>
          <div className='mt-2 text-2xl font-semibold tabular-nums'>
            {totals.down}
          </div>
        </div>
      </div>

      <div className='overflow-hidden rounded-lg border'>
        {rows.map(({ model, perf }) => {
          const status = getAvailabilityConfig(perf?.availability_status, t)
          const pct = perf?.availability_pct ?? 100
          const hasPct = Number.isFinite(pct)
          return (
            <button
              key={model.id ?? model.model_name}
              type='button'
              onClick={() => props.onModelClick(model.model_name)}
              className='hover:bg-muted/30 grid w-full grid-cols-1 gap-3 border-b p-3 text-left transition-colors last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)_minmax(160px,0.6fr)] md:items-center'
            >
              <div className='min-w-0'>
                <div className='flex min-w-0 items-center gap-2'>
                  <span className={cn('size-2 rounded-full', status.color)} />
                  <span className='truncate font-mono text-sm font-semibold'>
                    {model.model_name}
                  </span>
                </div>
                <div className='text-muted-foreground mt-1 line-clamp-1 text-xs'>
                  {model.description || t('No description available.')}
                </div>
              </div>

              <div>
                <div className='mb-1 flex items-center justify-between gap-2 text-xs'>
                  <span className='text-muted-foreground'>
                    {t('Availability')}
                  </span>
                  <span className='font-mono font-medium'>
                    {hasPct ? formatUptimePct(pct ?? 0) : '—'}
                  </span>
                </div>
                <Progress
                  value={hasPct ? (pct ?? 0) : 0}
                  className={cn(
                    'h-1.5',
                    perf?.availability_status === 'down' &&
                      '[&_[data-slot=progress-indicator]]:bg-red-500',
                    perf?.availability_status === 'degraded' &&
                      '[&_[data-slot=progress-indicator]]:bg-orange-500',
                    perf?.availability_status === 'stale' &&
                      '[&_[data-slot=progress-indicator]]:bg-sky-500',
                    perf?.availability_status === 'warning' &&
                      '[&_[data-slot=progress-indicator]]:bg-amber-500',
                    perf?.availability_status === 'healthy' &&
                      '[&_[data-slot=progress-indicator]]:bg-emerald-500'
                  )}
                />
              </div>

              <div className='text-xs'>
                <div className='text-muted-foreground flex items-center gap-1.5'>
                  <Timer className='size-3.5' />
                  <span>{t('Average TTFT')}</span>
                </div>
                <div className='mt-1 font-mono font-medium'>
                  {formatLatency(perf?.avg_latency_ms ?? 0)}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
