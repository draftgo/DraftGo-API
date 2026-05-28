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
import { CodeIcon, CopyIcon, CheckIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { buildChatCompletionPayload } from '../lib'
import type { Message, PlaygroundConfig, ParameterEnabled } from '../types'

interface PlaygroundJsonViewerProps {
  messages: Message[]
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
}

export function PlaygroundJsonViewer({
  messages,
  config,
  parameterEnabled,
}: PlaygroundJsonViewerProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const jsonPayload = useMemo(() => {
    const payload = buildChatCompletionPayload(messages, config, parameterEnabled)
    return JSON.stringify(payload, null, 2)
  }, [messages, config, parameterEnabled])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonPayload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant='outline' size='icon' className='size-8'>
            <CodeIcon className='size-4' />
            <span className='sr-only'>{t('View JSON')}</span>
          </Button>
        }
      />
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('Request JSON')}</DialogTitle>
        </DialogHeader>
        <div className='relative'>
          <Button
            variant='ghost'
            size='icon'
            className='absolute top-2 right-2 size-7'
            onClick={handleCopy}
          >
            {copied ? (
              <CheckIcon className='size-3.5' />
            ) : (
              <CopyIcon className='size-3.5' />
            )}
          </Button>
          <pre className='bg-muted max-h-[60vh] overflow-auto rounded-lg p-4 text-xs'>
            <code>{jsonPayload}</code>
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  )
}
