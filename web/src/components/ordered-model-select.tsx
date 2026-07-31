/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MultiSelect, type Option } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type OrderedModelSelectProps = {
  options: Option[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
  disabled?: boolean
  allowCreate?: boolean
}

export function OrderedModelSelect(props: OrderedModelSelectProps) {
  const { t } = useTranslation()

  const moveModel = (index: number, offset: -1 | 1) => {
    const targetIndex = index + offset
    if (targetIndex < 0 || targetIndex >= props.value.length) return
    const next = [...props.value]
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    props.onChange(next)
  }

  const removeModel = (modelName: string) => {
    props.onChange(props.value.filter((item) => item !== modelName))
  }

  return (
    <div className='space-y-2'>
      <MultiSelect
        options={props.options}
        selected={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        disabled={props.disabled}
        allowCreate={props.allowCreate}
      />
      {props.value.length > 0 && (
        <ol className='divide-y overflow-hidden rounded-md border'>
          {props.value.map((modelName, index) => (
            <li
              key={modelName}
              className='bg-background flex min-h-10 min-w-0 items-center gap-2 px-2 py-1.5'
            >
              <span className='bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded text-xs font-medium'>
                {index + 1}
              </span>
              <span className='min-w-0 flex-1 truncate font-mono text-xs sm:text-sm'>
                {modelName}
              </span>
              <div className='flex shrink-0 items-center gap-0.5'>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        disabled={props.disabled || index === 0}
                        onClick={() => moveModel(index, -1)}
                        aria-label={t('Move model up')}
                      />
                    }
                  >
                    <ChevronUp aria-hidden='true' />
                  </TooltipTrigger>
                  <TooltipContent>{t('Move model up')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        disabled={
                          props.disabled || index === props.value.length - 1
                        }
                        onClick={() => moveModel(index, 1)}
                        aria-label={t('Move model down')}
                      />
                    }
                  >
                    <ChevronDown aria-hidden='true' />
                  </TooltipTrigger>
                  <TooltipContent>{t('Move model down')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        disabled={props.disabled}
                        onClick={() => removeModel(modelName)}
                        aria-label={t('Remove fallback model')}
                      />
                    }
                  >
                    <Trash2 aria-hidden='true' />
                  </TooltipTrigger>
                  <TooltipContent>{t('Remove fallback model')}</TooltipContent>
                </Tooltip>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
