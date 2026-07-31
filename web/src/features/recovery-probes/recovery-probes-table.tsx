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
import { Play, Radar, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatTimestampToDate } from '@/lib/format'

import type { RecoveryProbe, RecoveryProbeState } from './types'

const stateVariants: Record<
  RecoveryProbeState,
  'default' | 'secondary' | 'warning' | 'destructive' | 'outline'
> = {
  auto_disabled: 'destructive',
  fast_probing: 'warning',
  watching: 'secondary',
  probation: 'outline',
  enabled: 'default',
  parked: 'destructive',
}

const stateLabelKeys: Record<RecoveryProbeState, string> = {
  auto_disabled: 'Auto-disabled',
  fast_probing: 'Fast probing',
  watching: 'Watching',
  probation: 'Probation',
  enabled: 'Enabled',
  parked: 'Parked',
}

type RecoveryProbesTableProps = {
  probes: RecoveryProbe[]
  pendingTarget?: string
  onProbe: (probe: RecoveryProbe) => void
  onReset: (probe: RecoveryProbe) => void
}

const targetId = (probe: RecoveryProbe): string =>
  `${probe.channel_id}:${probe.key_index}`

export function RecoveryProbesTable(props: RecoveryProbesTableProps) {
  const { t } = useTranslation()

  if (props.probes.length === 0) {
    return (
      <Empty className='min-h-48 rounded-none border-y'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <Radar />
          </EmptyMedia>
          <EmptyTitle>{t('No recovery probes found')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className='overflow-hidden border-y'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Channel / Key')}</TableHead>
            <TableHead>{t('Recovery state')}</TableHead>
            <TableHead>{t('Streak')}</TableHead>
            <TableHead>{t('First-event latency')}</TableHead>
            <TableHead>{t('Daily probes')}</TableHead>
            <TableHead>{t('Last probe')}</TableHead>
            <TableHead>{t('Next probe')}</TableHead>
            <TableHead className='max-w-72'>{t('Last error')}</TableHead>
            <TableHead className='text-right'>{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.probes.map((probe) => {
            const isPending = props.pendingTarget === targetId(probe)
            return (
              <TableRow key={probe.id}>
                <TableCell>
                  <div className='max-w-56 min-w-36'>
                    <div
                      className='truncate font-medium'
                      title={probe.channel_name}
                    >
                      {probe.channel_name}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      #{probe.channel_id} /{' '}
                      {probe.key_index < 0
                        ? t('Single key')
                        : t('Key #{{index}}', { index: probe.key_index })}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={stateVariants[probe.state]}>
                    {t(stateLabelKeys[probe.state])}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span>{probe.success_streak}</span>
                  <span className='text-muted-foreground px-1'>/</span>
                  <span className='text-destructive'>
                    {probe.failure_streak}
                  </span>
                </TableCell>
                <TableCell>
                  {probe.last_latency_ms > 0
                    ? `${probe.last_latency_ms} ms`
                    : '-'}
                </TableCell>
                <TableCell>{probe.daily_probe_count}</TableCell>
                <TableCell>
                  {probe.last_probe_at > 0
                    ? formatTimestampToDate(probe.last_probe_at)
                    : '-'}
                </TableCell>
                <TableCell>
                  {probe.next_probe_at > 0
                    ? formatTimestampToDate(probe.next_probe_at)
                    : '-'}
                </TableCell>
                <TableCell className='max-w-72'>
                  <div
                    className='truncate'
                    title={probe.last_error || probe.disable_reason}
                  >
                    {probe.last_error || probe.disable_reason || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex justify-end gap-1'>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type='button'
                            size='icon-sm'
                            variant='ghost'
                            disabled={isPending}
                            aria-label={t('Probe now')}
                            onClick={() => props.onProbe(probe)}
                          />
                        }
                      >
                        <Play />
                      </TooltipTrigger>
                      <TooltipContent>{t('Probe now')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type='button'
                            size='icon-sm'
                            variant='ghost'
                            disabled={isPending}
                            aria-label={t('Reset recovery state')}
                            onClick={() => props.onReset(probe)}
                          />
                        }
                      >
                        <RotateCcw />
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('Reset recovery state')}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export { stateLabelKeys, targetId }
