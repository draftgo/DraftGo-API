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
import { PlusIcon, Trash2Icon, GripVerticalIcon, InfoIcon, LinkIcon, CodeIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SettingsSection } from '../components/settings-section'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { useUpdateOption } from '../hooks/use-update-option'

export type CustomNavLink = {
  title: string
  url: string
  enabled: boolean
  adminOnly: boolean
  external: boolean
  showNav: boolean
  type: 'link' | 'html'
}

export function parseCustomNavLinks(value: string | null | undefined): CustomNavLink[] {
  if (!value || value.trim() === '') return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item: unknown): item is Record<string, unknown> =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).title === 'string' &&
          typeof (item as Record<string, unknown>).url === 'string'
      )
      .map((item) => ({
        title: item.title as string,
        url: item.url as string,
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        adminOnly: typeof item.adminOnly === 'boolean' ? item.adminOnly : false,
        external: typeof item.external === 'boolean' ? item.external : true,
        showNav: typeof item.showNav === 'boolean' ? item.showNav : false,
        type: item.type === 'html' ? 'html' as const : 'link' as const,
      }))
  } catch {
    return []
  }
}

export function serializeCustomNavLinks(links: CustomNavLink[]): string {
  return JSON.stringify(links)
}

type HeaderCustomLinksSectionProps = {
  initialValue: string
}

export function HeaderCustomLinksSection({
  initialValue,
}: HeaderCustomLinksSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [links, setLinks] = useState<CustomNavLink[]>(() =>
    parseCustomNavLinks(initialValue)
  )

  useEffect(() => {
    setLinks(parseCustomNavLinks(initialValue))
  }, [initialValue])

  const addLink = () => {
    setLinks((prev) => [
      ...prev,
      {
        title: '',
        url: '',
        enabled: true,
        adminOnly: false,
        external: false,
        showNav: true,
        type: 'link',
      },
    ])
  }

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index))
  }

  const updateLink = (index: number, field: keyof CustomNavLink, value: string | boolean) => {
    setLinks((prev) =>
      prev.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      )
    )
  }

  const handleSave = async () => {
    const validLinks = links.filter((l) => l.title.trim() && l.url.trim())
    const serialized = serializeCustomNavLinks(validLinks)
    if (serialized === initialValue) return

    await updateOption.mutateAsync({
      key: 'HeaderNavCustomLinks',
      value: serialized,
    })
    toast.success(t('Setting updated successfully'))
  }

  const handleReset = () => {
    setLinks([])
  }

  const templateVars = [
    { token: '{key}', desc: t('API Key (auto-prefixed with sk-)') },
    { token: '{token}', desc: t('System access token') },
    { token: '{address}', desc: t('Server address (URL encoded)') },
  ]

  return (
    <SettingsSection title={t('Custom navigation')}>
      <SettingsPageFormActions
        onSave={handleSave}
        onReset={handleReset}
        isSaving={updateOption.isPending}
        resetLabel='Clear all'
        saveLabel='Save custom navigation'
      />

      <div className='space-y-3'>
        <div className='flex items-center gap-2'>
          <Tooltip>
            <TooltipTrigger>
              <InfoIcon className='text-muted-foreground size-4' />
            </TooltipTrigger>
            <TooltipContent side='right' className='max-w-xs'>
              <p className='mb-2 text-sm font-medium'>
                {t('Supported template variables')}:
              </p>
              <ul className='space-y-1 text-xs'>
                {templateVars.map((v) => (
                  <li key={v.token}>
                    <code className='bg-muted rounded px-1'>{v.token}</code>
                    {' — '}
                    {v.desc}
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
          <span className='text-muted-foreground text-xs'>
            {t(
              'URLs can use template variables like {key}, {token} and {address}'
            )}
          </span>
        </div>

        {links.map((link, index) => (
          <div
            key={index}
            className='bg-muted/50 flex items-start gap-2 rounded-lg border p-3'
          >
            <GripVerticalIcon className='text-muted-foreground mt-2 size-4 shrink-0' />
            <div className='flex-1 space-y-3'>
              <div className='grid gap-2 sm:grid-cols-2'>
                <div className='space-y-1'>
                  <Label className='text-xs'>{t('Title')}</Label>
                  <Input
                    value={link.title}
                    onChange={(e) => updateLink(index, 'title', e.target.value)}
                    placeholder={t('Navigation title')}
                    className='h-8 text-sm'
                  />
                </div>
                <div className='space-y-1'>
                  <Label className='text-xs'>{t('Content type')}</Label>
                  <div className='flex gap-1'>
                    <Button
                      type='button'
                      variant={link.type === 'link' ? 'default' : 'outline'}
                      size='sm'
                      className='h-8 flex-1 gap-1 text-xs'
                      onClick={() => updateLink(index, 'type', 'link')}
                    >
                      <LinkIcon className='size-3' />
                      {t('URL')}
                    </Button>
                    <Button
                      type='button'
                      variant={link.type === 'html' ? 'default' : 'outline'}
                      size='sm'
                      className='h-8 flex-1 gap-1 text-xs'
                      onClick={() => updateLink(index, 'type', 'html')}
                    >
                      <CodeIcon className='size-3' />
                      HTML
                    </Button>
                  </div>
                </div>
              </div>

              {link.type === 'link' ? (
                <div className='space-y-1'>
                  <Label className='text-xs'>{t('URL')}</Label>
                  <Input
                    value={link.url}
                    onChange={(e) => updateLink(index, 'url', e.target.value)}
                    placeholder='https://example.com?token={token}'
                    className='h-8 text-sm'
                  />
                </div>
              ) : (
                <div className='space-y-1'>
                  <Label className='text-xs'>{t('HTML content')}</Label>
                  <Textarea
                    value={link.url}
                    onChange={(e) => updateLink(index, 'url', e.target.value)}
                    placeholder='<div>...</div>'
                    className='min-h-[80px] font-mono text-xs'
                  />
                </div>
              )}

              <div className='flex flex-wrap items-center gap-4'>
                <div className='flex items-center gap-2'>
                  <Switch
                    id={`enabled-${index}`}
                    checked={link.enabled}
                    onCheckedChange={(checked) =>
                      updateLink(index, 'enabled', checked)
                    }
                  />
                  <Label htmlFor={`enabled-${index}`} className='text-xs'>
                    {t('Enabled')}
                  </Label>
                </div>
                <div className='flex items-center gap-2'>
                  <Switch
                    id={`adminOnly-${index}`}
                    checked={link.adminOnly}
                    onCheckedChange={(checked) =>
                      updateLink(index, 'adminOnly', checked)
                    }
                  />
                  <Label htmlFor={`adminOnly-${index}`} className='text-xs'>
                    {t('Admin only')}
                  </Label>
                </div>
                <div className='flex items-center gap-2'>
                  <Switch
                    id={`showNav-${index}`}
                    checked={link.showNav}
                    onCheckedChange={(checked) =>
                      updateLink(index, 'showNav', checked)
                    }
                  />
                  <Label htmlFor={`showNav-${index}`} className='text-xs'>
                    {t('Keep navigation bar')}
                  </Label>
                </div>
                {link.type === 'link' && !link.showNav && (
                  <div className='flex items-center gap-2'>
                    <Switch
                      id={`external-${index}`}
                      checked={link.external}
                      onCheckedChange={(checked) =>
                        updateLink(index, 'external', checked)
                      }
                    />
                    <Label htmlFor={`external-${index}`} className='text-xs'>
                      {t('Open in new tab')}
                    </Label>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant='ghost'
              size='icon'
              className='mt-1 size-7 shrink-0 text-destructive'
              onClick={() => removeLink(index)}
            >
              <Trash2Icon className='size-3.5' />
            </Button>
          </div>
        ))}

        <Button
          variant='outline'
          size='sm'
          className='gap-1.5'
          onClick={addLink}
        >
          <PlusIcon className='size-3.5' />
          {t('Add navigation')}
        </Button>
      </div>
    </SettingsSection>
  )
}
