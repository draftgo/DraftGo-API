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
import { useMemo, useState } from 'react'
import { GitCompareIcon, SearchIcon, Settings2Icon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import type { ModelOption } from '../types'

interface PlaygroundModelCompareProps {
  enabled: boolean
  models: ModelOption[]
  selectedModels: string[]
  disabled?: boolean
  onEnabledChange: (enabled: boolean) => void
  onSelectedModelsChange: (models: string[]) => void
}

const MAX_COMPARE_MODELS = 4

export function PlaygroundModelCompare({
  enabled,
  models,
  selectedModels,
  disabled,
  onEnabledChange,
  onSelectedModelsChange,
}: PlaygroundModelCompareProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const normalizedSelected = useMemo(() => {
    const available = new Set(models.map((model) => model.value))
    const selected = selectedModels.filter((model) => available.has(model))
    return selected.length > 0 ? selected : models.slice(0, 1).map((m) => m.value)
  }, [models, selectedModels])

  const filteredModels = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return models
    return models.filter(
      (model) =>
        model.label.toLowerCase().includes(keyword) ||
        model.value.toLowerCase().includes(keyword)
    )
  }, [models, query])

  const selectedSet = useMemo(
    () => new Set(normalizedSelected),
    [normalizedSelected]
  )

  const toggleModel = (model: string, checked: boolean) => {
    if (checked) {
      if (normalizedSelected.includes(model)) return
      onSelectedModelsChange(
        [...normalizedSelected, model].slice(0, MAX_COMPARE_MODELS)
      )
      return
    }

    if (normalizedSelected.length <= 1) return
    onSelectedModelsChange(normalizedSelected.filter((item) => item !== model))
  }

  return (
    <>
      <div
        className={cn(
          'bg-background flex min-w-0 flex-wrap items-center gap-2 rounded-lg border px-3 py-2',
          enabled && 'border-primary/30 bg-primary/5'
        )}
      >
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          <GitCompareIcon className='text-muted-foreground size-4 shrink-0' />
          <Label
            htmlFor='playground-compare-mode'
            className='cursor-pointer text-sm font-medium'
          >
            {t('Compare mode')}
          </Label>
          <Switch
            id='playground-compare-mode'
            size='sm'
            checked={enabled}
            disabled={disabled || models.length === 0}
            onCheckedChange={onEnabledChange}
          />
          <span className='text-muted-foreground hidden truncate text-xs sm:inline'>
            {t('Send the same prompt to multiple models')}
          </span>
        </div>

        {enabled && (
          <div className='flex min-w-0 flex-wrap items-center gap-1.5'>
            {normalizedSelected.slice(0, 3).map((model) => (
              <Badge
                key={model}
                variant='secondary'
                className='max-w-36 rounded-md'
              >
                <span className='truncate'>{model}</span>
              </Badge>
            ))}
            {normalizedSelected.length > 3 && (
              <Badge variant='outline' className='rounded-md'>
                +{normalizedSelected.length - 3}
              </Badge>
            )}
          </div>
        )}

        <Button
          type='button'
          variant='outline'
          size='sm'
          className='gap-1.5'
          disabled={disabled || models.length === 0}
          onClick={() => setOpen(true)}
        >
          <Settings2Icon className='size-3.5' />
          {t('Models')}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-h-[85vh] max-w-2xl overflow-hidden p-0'>
          <DialogHeader className='border-b px-5 pt-5 pb-4'>
            <DialogTitle>{t('Compare models')}</DialogTitle>
          </DialogHeader>

          <div className='grid gap-4 px-5 py-4'>
            <div className='relative'>
              <SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className='pr-9 pl-9'
                placeholder={t('Search models...')}
              />
              {query && (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  className='absolute top-1/2 right-1 -translate-y-1/2'
                  onClick={() => setQuery('')}
                  aria-label={t('Clear search')}
                >
                  <XIcon className='size-4' />
                </Button>
              )}
            </div>

            <div className='text-muted-foreground flex items-center justify-between text-xs'>
              <span>
                {t('{{n}} model(s) selected', {
                  n: normalizedSelected.length,
                })}
              </span>
              <span>{t('Up to {{count}} models', { count: MAX_COMPARE_MODELS })}</span>
            </div>

            <ScrollArea className='h-[360px] rounded-lg border'>
              <div className='grid gap-1 p-2'>
                {filteredModels.map((model) => {
                  const checked = selectedSet.has(model.value)
                  const disableCheck =
                    !checked && normalizedSelected.length >= MAX_COMPARE_MODELS

                  return (
                    <button
                      key={model.value}
                      type='button'
                      className={cn(
                        'hover:bg-muted flex min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                        checked && 'bg-primary/10'
                      )}
                      disabled={disableCheck}
                      onClick={() => toggleModel(model.value, !checked)}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disableCheck}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={(value) =>
                          toggleModel(model.value, !!value)
                        }
                      />
                      <div className='min-w-0 flex-1'>
                        <div className='truncate text-sm font-medium'>
                          {model.label}
                        </div>
                        <div className='text-muted-foreground truncate text-xs'>
                          {model.value}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className='px-5'>
            <Button type='button' onClick={() => setOpen(false)}>
              {t('Done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
