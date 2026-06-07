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
import { useEffect, useState } from 'react'
import { SettingsIcon, RotateCcwIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { PlaygroundConfig, ParameterEnabled } from '../types'

interface ParameterSliderProps {
  label: string
  paramKey: keyof ParameterEnabled
  value: number
  enabled: boolean
  min: number
  max: number
  step: number
  onValueChange: (value: number) => void
  onEnabledChange: (enabled: boolean) => void
}

function ParameterSlider({
  label,
  paramKey,
  value,
  enabled,
  min,
  max,
  step,
  onValueChange,
  onEnabledChange,
}: ParameterSliderProps) {
  const [inputValue, setInputValue] = useState(String(value))

  useEffect(() => {
    setInputValue(String(value))
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setInputValue(raw)
    const num = parseFloat(raw)
    if (!isNaN(num) && num >= min && num <= max) {
      onValueChange(num)
    }
  }

  const handleInputBlur = () => {
    const num = parseFloat(inputValue)
    if (isNaN(num) || num < min) {
      onValueChange(min)
      setInputValue(String(min))
    } else if (num > max) {
      onValueChange(max)
      setInputValue(String(max))
    } else {
      const rounded = Math.round(num / step) * step
      const fixed = Number(rounded.toFixed(10))
      onValueChange(fixed)
      setInputValue(String(fixed))
    }
  }

  const handleSliderChange = (val: number | readonly number[]) => {
    const num = Array.isArray(val) ? val[0] : val
    onValueChange(num)
    setInputValue(String(num))
  }

  return (
    <div className='bg-background rounded-md border px-3 py-3'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Switch
            id={`param-${paramKey}`}
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          <Label
            htmlFor={`param-${paramKey}`}
            className={!enabled ? 'text-muted-foreground text-sm' : 'text-sm'}
          >
            {label}
          </Label>
        </div>
        <Input
          className='h-7 w-18 text-center text-xs'
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          disabled={!enabled}
          type='number'
          min={min}
          max={max}
          step={step}
        />
      </div>
      <div className='pt-3'>
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={handleSliderChange}
          disabled={!enabled}
        />
      </div>
    </div>
  )
}

interface PlaygroundSettingsProps {
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  onConfigChange: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
  onParameterEnabledChange: (
    key: keyof ParameterEnabled,
    value: boolean
  ) => void
  onReset: () => void
}

export function PlaygroundSettings({
  config,
  parameterEnabled,
  onConfigChange,
  onParameterEnabledChange,
  onReset,
}: PlaygroundSettingsProps) {
  const { t } = useTranslation()

  const parameters: Array<{
    key: keyof ParameterEnabled
    label: string
    min: number
    max: number
    step: number
    configKey: keyof PlaygroundConfig
  }> = [
    {
      key: 'temperature',
      label: t('Temperature'),
      min: 0,
      max: 2,
      step: 0.1,
      configKey: 'temperature',
    },
    {
      key: 'top_p',
      label: t('Top P'),
      min: 0,
      max: 1,
      step: 0.05,
      configKey: 'top_p',
    },
    {
      key: 'max_tokens',
      label: t('Max Tokens'),
      min: 1,
      max: 128000,
      step: 1,
      configKey: 'max_tokens',
    },
    {
      key: 'frequency_penalty',
      label: t('Frequency Penalty'),
      min: -2,
      max: 2,
      step: 0.1,
      configKey: 'frequency_penalty',
    },
    {
      key: 'presence_penalty',
      label: t('Presence Penalty'),
      min: -2,
      max: 2,
      step: 0.1,
      configKey: 'presence_penalty',
    },
    {
      key: 'seed',
      label: t('Seed'),
      min: 0,
      max: 999999,
      step: 1,
      configKey: 'seed',
    },
  ]

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant='outline' size='icon' className='size-8'>
            <SettingsIcon className='size-4' />
            <span className='sr-only'>{t('Advanced Settings')}</span>
          </Button>
        }
      />
      <SheetContent
        side='right'
        className='w-[92vw] overflow-y-auto sm:max-w-xl'
      >
        <SheetHeader className='border-b px-5 py-4'>
          <SheetTitle>{t('Advanced Settings')}</SheetTitle>
        </SheetHeader>

        <div className='space-y-5 px-5 pb-6'>
          <div className='bg-background flex items-center justify-between gap-4 rounded-md border px-3 py-3'>
            <div className='min-w-0'>
              <Label className='text-sm font-medium'>{t('Stream')}</Label>
              <p className='text-muted-foreground mt-1 text-xs'>
                {t('Return assistant output as a stream')}
              </p>
            </div>
            <Switch
              className='shrink-0'
              checked={config.stream}
              onCheckedChange={(checked) => onConfigChange('stream', checked)}
            />
          </div>

          <div>
            <div className='mb-4 flex items-center justify-between'>
              <span className='text-sm font-medium'>{t('Parameters')}</span>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 gap-1 text-xs'
                onClick={onReset}
              >
                <RotateCcwIcon className='size-3' />
                {t('Reset')}
              </Button>
            </div>

            <div className='space-y-3'>
              {parameters.map((param) => (
                <ParameterSlider
                  key={param.key}
                  label={param.label}
                  paramKey={param.key}
                  value={(config[param.configKey] as number) ?? 0}
                  enabled={parameterEnabled[param.key]}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  onValueChange={(value) =>
                    onConfigChange(
                      param.configKey,
                      value as PlaygroundConfig[typeof param.configKey]
                    )
                  }
                  onEnabledChange={(enabled) =>
                    onParameterEnabledChange(param.key, enabled)
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
