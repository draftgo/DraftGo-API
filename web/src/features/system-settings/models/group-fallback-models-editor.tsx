/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { OrderedModelSelect } from '@/components/ordered-model-select'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { getUserModels } from '@/lib/api'

import { safeJsonParse } from '../utils/json-parser'

type GroupFallbackModelsEditorProps = {
  value: string
  groupOptions: string[]
  onChange: (value: string) => void
}

export function GroupFallbackModelsEditor(
  props: GroupFallbackModelsEditorProps
) {
  const { t } = useTranslation()
  const availableGroups = useMemo(
    () => [...new Set(props.groupOptions)].filter((group) => group !== 'auto'),
    [props.groupOptions]
  )
  const [selectedGroupValue, setSelectedGroupValue] = useState('')
  const selectedGroup = availableGroups.includes(selectedGroupValue)
    ? selectedGroupValue
    : (availableGroups[0] ?? '')

  const fallbackMap = useMemo(
    () =>
      safeJsonParse<Record<string, string[]>>(props.value, {
        fallback: {},
        silent: true,
      }),
    [props.value]
  )
  const { data: modelsData } = useQuery({
    queryKey: ['user-models', selectedGroup],
    queryFn: () => getUserModels(selectedGroup),
    enabled: !!selectedGroup,
    staleTime: 0,
  })
  const modelOptions = useMemo(
    () =>
      (modelsData?.data ?? []).map((model) => ({
        label: model,
        value: model,
      })),
    [modelsData?.data]
  )

  const updateSelectedModels = (models: string[]) => {
    if (!selectedGroup) return
    const next = { ...fallbackMap }
    if (models.length === 0) {
      delete next[selectedGroup]
    } else {
      next[selectedGroup] = models
    }
    props.onChange(JSON.stringify(next, null, 2))
  }

  if (availableGroups.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>
        {t('Add a group before configuring fallback models.')}
      </p>
    )
  }

  return (
    <section className='space-y-3'>
      <Separator />
      <div className='space-y-1'>
        <h3 className='text-sm font-semibold'>{t('Group fallback models')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Configure the ordered system fallback list used by enabled tokens that have no token-specific fallback models.'
          )}
        </p>
      </div>
      <div className='grid gap-3 md:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)] md:items-start'>
        <Select
          items={availableGroups}
          value={selectedGroup}
          onValueChange={(value) => setSelectedGroupValue(value ?? '')}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {availableGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <OrderedModelSelect
          options={modelOptions}
          value={fallbackMap[selectedGroup] ?? []}
          onChange={updateSelectedModels}
          placeholder={t('Select fallback models in priority order')}
          allowCreate
        />
      </div>
    </section>
  )
}
