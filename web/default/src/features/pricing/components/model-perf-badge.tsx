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
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
} from '@/features/performance-metrics/lib/format'
import type {
  AvailabilityStatus,
  HealthSource,
} from '@/features/performance-metrics/types'

export type ModelPerfBadgeData = {
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
  request_count?: number
  availability_pct?: number
  availability_status?: AvailabilityStatus
  available_channels?: number
  total_channels?: number
  tested_channels?: number
  fresh_tested_channels?: number
  last_test_time?: number
  avg_test_latency_ms?: number
  auto_test_enabled?: boolean
  auto_test_interval_minutes?: number
  health_source?: HealthSource
}

export interface ModelPerfBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  perf: ModelPerfBadgeData | undefined
}

function formatCompactThroughput(tps: number): string {
  return formatThroughput(tps).replace(' t/s', 'tps')
}

export function getAvailabilityConfig(
  status: AvailabilityStatus | undefined,
  t: (key: string) => string
) {
  switch (status) {
    case 'healthy':
      return { color: 'bg-emerald-500', label: t('Healthy') }
    case 'warning':
      return { color: 'bg-amber-500', label: t('Warning') }
    case 'stale':
      return { color: 'bg-sky-500', label: t('Stale') }
    case 'degraded':
      return { color: 'bg-orange-500', label: t('Degraded') }
    case 'down':
      return { color: 'bg-red-500', label: t('Unavailable') }
    default:
      return { color: 'bg-muted-foreground/40', label: t('No data') }
  }
}

export function getHealthSourceLabel(
  source: HealthSource | undefined,
  t: (key: string) => string
) {
  switch (source) {
    case 'mixed':
      return t('Traffic + scheduled tests')
    case 'traffic':
      return t('Traffic')
    case 'scheduled_test':
      return t('Scheduled tests')
    case 'channel_status':
      return t('Channel status')
    default:
      return t('No data')
  }
}

export const ModelPerfBadge = memo(function ModelPerfBadge(
  props: ModelPerfBadgeProps
) {
  const { t } = useTranslation()

  const hasCalls = (props.perf?.request_count ?? 0) > 0
  const successRate =
    props.perf && hasCalls && Number.isFinite(props.perf.success_rate)
      ? props.perf.success_rate
      : (props.perf?.availability_pct ?? 100)
  const avgLatencyMs =
    props.perf?.avg_latency_ms || props.perf?.avg_test_latency_ms || 0
  const avgTps = props.perf?.avg_tps ?? 0
  const availability = getAvailabilityConfig(props.perf?.availability_status, t)
  const sourceLabel = getHealthSourceLabel(props.perf?.health_source, t)
  const availableChannels = props.perf?.available_channels ?? 0
  const totalChannels = props.perf?.total_channels ?? 0

  return (
    <div
      className={cn(
        'hidden w-[136px] grid-cols-[38px_48px_34px] gap-x-2 text-right tabular-nums min-[460px]:grid',
        props.className
      )}
    >
      <div title={t('Average latency')} className='min-w-0'>
        <div className='text-muted-foreground/55 text-[10px] leading-4'>
          {t('Latency short')}
        </div>
        <div className='text-muted-foreground/80 font-mono text-xs leading-4 whitespace-nowrap'>
          {avgLatencyMs > 0 ? formatLatency(avgLatencyMs) : '—'}
        </div>
      </div>
      <div title={t('Throughput')} className='min-w-0'>
        <div className='text-muted-foreground/55 truncate text-[10px] leading-4'>
          {t('Throughput short')}
        </div>
        <div className='text-muted-foreground/80 font-mono text-xs leading-4 whitespace-nowrap'>
          {formatCompactThroughput(avgTps)}
        </div>
      </div>
      <div
        title={`${t('Availability')}: ${
          Number.isFinite(successRate)
            ? formatUptimePct(successRate)
            : formatUptimePct(100)
        } · ${availability.label} · ${sourceLabel} · ${availableChannels}/${totalChannels} ${t('channels')}`}
        className='min-w-0'
      >
        <div className='text-muted-foreground/55 truncate text-[10px] leading-4'>
          {t('Status short')}
        </div>
        <div className='flex h-4 items-center justify-end gap-1'>
          <span className={cn('size-1.5 rounded-full', availability.color)} />
          <span className='text-muted-foreground/80 font-mono text-[11px] leading-4 whitespace-nowrap'>
            {Number.isFinite(successRate)
              ? `${Math.round(successRate)}%`
              : '100%'}
          </span>
        </div>
      </div>
    </div>
  )
})
