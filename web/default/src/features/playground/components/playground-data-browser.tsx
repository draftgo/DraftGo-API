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
import {
  DatabaseIcon,
  Trash2Icon,
  DownloadIcon,
  UploadIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { STORAGE_KEYS } from '../constants'
import type { Message } from '../types'

interface PlaygroundDataBrowserProps {
  messages: Message[]
  onClearMessages: () => void
  onImportMessages: (messages: Message[]) => void
}

export function PlaygroundDataBrowser({
  messages,
  onClearMessages,
  onImportMessages,
}: PlaygroundDataBrowserProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const storageInfo = useMemo(() => {
    const entries = Object.values(STORAGE_KEYS).map((key) => {
      const data = localStorage.getItem(key)
      return {
        key,
        size: data ? new Blob([data]).size : 0,
        exists: data !== null,
      }
    })
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0)
    return { entries, totalSize }
  }, [open])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const messageCount = messages.filter((m) => m.from === 'user').length
  const totalMessages = messages.length

  const handleExport = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      config: localStorage.getItem(STORAGE_KEYS.CONFIG),
      parameterEnabled: localStorage.getItem(STORAGE_KEYS.PARAMETER_ENABLED),
      messages: localStorage.getItem(STORAGE_KEYS.MESSAGES),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `playground-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('Data exported successfully'))
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string)
          if (data.config) {
            localStorage.setItem(STORAGE_KEYS.CONFIG, data.config)
          }
          if (data.parameterEnabled) {
            localStorage.setItem(
              STORAGE_KEYS.PARAMETER_ENABLED,
              data.parameterEnabled
            )
          }
          if (data.messages) {
            const parsed = JSON.parse(data.messages)
            if (Array.isArray(parsed)) {
              onImportMessages(parsed)
            }
          }
          toast.success(t('Data imported successfully'))
          setOpen(false)
        } catch {
          toast.error(t('Invalid import file'))
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleClear = () => {
    onClearMessages()
    toast.success(t('Conversation cleared'))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant='outline' size='icon' className='size-8'>
            <DatabaseIcon className='size-4' />
            <span className='sr-only'>{t('Data Browser')}</span>
          </Button>
        }
      />
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Data Browser')}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='bg-muted rounded-lg p-3'>
            <div className='grid grid-cols-2 gap-2 text-sm'>
              <div>
                <span className='text-muted-foreground'>{t('Conversations')}</span>
                <p className='font-medium'>{messageCount}</p>
              </div>
              <div>
                <span className='text-muted-foreground'>{t('Total Messages')}</span>
                <p className='font-medium'>{totalMessages}</p>
              </div>
              <div>
                <span className='text-muted-foreground'>{t('Storage Used')}</span>
                <p className='font-medium'>{formatSize(storageInfo.totalSize)}</p>
              </div>
            </div>
          </div>

          <div className='space-y-2'>
            <h4 className='text-sm font-medium'>{t('Storage Keys')}</h4>
            <div className='space-y-1'>
              {storageInfo.entries.map((entry) => (
                <div
                  key={entry.key}
                  className='flex items-center justify-between rounded px-2 py-1 text-xs'
                >
                  <code className='text-muted-foreground'>{entry.key}</code>
                  <span className={entry.exists ? '' : 'text-muted-foreground'}>
                    {entry.exists ? formatSize(entry.size) : t('empty')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className='flex flex-wrap gap-2 border-t pt-4'>
            <Button
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={handleExport}
            >
              <DownloadIcon className='size-3.5' />
              {t('Export')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={handleImport}
            >
              <UploadIcon className='size-3.5' />
              {t('Import')}
            </Button>
            <Button
              variant='destructive'
              size='sm'
              className='ml-auto gap-1.5'
              onClick={handleClear}
              disabled={messages.length === 0}
            >
              <Trash2Icon className='size-3.5' />
              {t('Clear')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
