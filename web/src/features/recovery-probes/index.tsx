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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { getRecoveryProbes, probeRecoveryNow, resetRecoveryProbe } from './api'
import {
  RecoveryProbesTable,
  stateLabelKeys,
  targetId,
} from './recovery-probes-table'
import {
  recoveryProbeStates,
  type RecoveryProbe,
  type RecoveryProbeState,
} from './types'

const PAGE_SIZE = 20

export function RecoveryProbes() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [state, setState] = useState<RecoveryProbeState | 'all'>('all')
  const [channelFilter, setChannelFilter] = useState('')
  const [pendingTarget, setPendingTarget] = useState<string>()
  const channelId = Number.parseInt(channelFilter, 10)

  const query = useQuery({
    queryKey: ['recovery-probes', page, state, channelId || 0],
    queryFn: () =>
      getRecoveryProbes({
        page,
        page_size: PAGE_SIZE,
        state: state === 'all' ? undefined : state,
        channel_id: Number.isFinite(channelId) ? channelId : undefined,
      }),
    refetchInterval: 10_000,
  })

  const mutation = useMutation({
    mutationFn: async (input: {
      probe: RecoveryProbe
      action: 'probe' | 'reset'
    }) => {
      setPendingTarget(targetId(input.probe))
      if (input.action === 'probe') {
        return probeRecoveryNow(input.probe.channel_id, input.probe.key_index)
      }
      return resetRecoveryProbe(input.probe.channel_id, input.probe.key_index)
    },
    onSuccess: (response) => {
      if (!response.success) {
        toast.error(response.message || t('Recovery action failed'))
        return
      }
      toast.success(t('Recovery action scheduled'))
      queryClient.invalidateQueries({ queryKey: ['recovery-probes'] })
    },
    onError: () => toast.error(t('Recovery action failed')),
    onSettled: () => setPendingTarget(undefined),
  })

  const data = query.data?.data
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Upstream Probes')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          type='button'
          variant='outline'
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            data-icon='inline-start'
            className={query.isFetching ? 'animate-spin' : undefined}
          />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 flex-col gap-4'>
          <div className='grid grid-cols-2 border-y sm:grid-cols-3 lg:grid-cols-6'>
            {recoveryProbeStates.map((probeState) => (
              <button
                type='button'
                key={probeState}
                className='hover:bg-muted/50 flex min-h-16 flex-col justify-center border-r px-3 text-left last:border-r-0'
                onClick={() => {
                  setState(probeState)
                  setPage(1)
                }}
              >
                <span className='text-muted-foreground text-xs'>
                  {t(stateLabelKeys[probeState])}
                </span>
                <span className='text-lg font-semibold tabular-nums'>
                  {data?.counts[probeState] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <Select
              value={state}
              onValueChange={(value) => {
                setState(value as RecoveryProbeState | 'all')
                setPage(1)
              }}
            >
              <SelectTrigger className='w-48' aria-label={t('Recovery state')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectItem value='all'>
                    {t('All recovery states')}
                  </SelectItem>
                  {recoveryProbeStates.map((probeState) => (
                    <SelectItem key={probeState} value={probeState}>
                      {t(stateLabelKeys[probeState])}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Input
              className='w-48'
              inputMode='numeric'
              placeholder={t('Channel ID')}
              value={channelFilter}
              onChange={(event) => {
                setChannelFilter(event.target.value.replaceAll(/[^0-9]/g, ''))
                setPage(1)
              }}
            />
          </div>

          <div className='min-h-0 flex-1 overflow-auto'>
            <RecoveryProbesTable
              probes={data?.items ?? []}
              pendingTarget={pendingTarget}
              onProbe={(probe) => mutation.mutate({ probe, action: 'probe' })}
              onReset={(probe) => mutation.mutate({ probe, action: 'reset' })}
            />
          </div>

          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>
              {t('{{count}} recovery targets', { count: data?.total ?? 0 })}
            </span>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                size='icon-sm'
                variant='outline'
                aria-label={t('Previous page')}
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft />
              </Button>
              <span className='min-w-16 text-center tabular-nums'>
                {page} / {totalPages}
              </span>
              <Button
                type='button'
                size='icon-sm'
                variant='outline'
                aria-label={t('Next page')}
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
