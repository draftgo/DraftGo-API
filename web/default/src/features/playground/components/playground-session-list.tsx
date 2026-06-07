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
import {
  MessageSquareIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { PlaygroundSession } from '../types'

interface PlaygroundSessionListProps {
  sessions: PlaygroundSession[]
  activeSessionId: string
  collapsed: boolean
  onToggleCollapsed: () => void
  onCreateSession: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
}

function formatSessionTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export function PlaygroundSessionList({
  sessions,
  activeSessionId,
  collapsed,
  onToggleCollapsed,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
}: PlaygroundSessionListProps) {
  const { t } = useTranslation()

  if (collapsed) {
    return (
      <div className='hidden h-full shrink-0 border-r px-2 py-3 md:flex md:w-14 md:flex-col md:items-center md:gap-2'>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant='ghost' size='icon' onClick={onToggleCollapsed} />
            }
          >
            <PanelLeftOpenIcon className='size-4' />
          </TooltipTrigger>
          <TooltipContent side='right'>{t('Expand sessions')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant='outline' size='icon' onClick={onCreateSession} />
            }
          >
            <PlusIcon className='size-4' />
          </TooltipTrigger>
          <TooltipContent side='right'>{t('New session')}</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <aside className='bg-background hidden h-full w-72 shrink-0 border-r md:flex md:flex-col'>
      <div className='flex items-center justify-between gap-2 border-b px-3 py-3'>
        <div className='min-w-0'>
          <h2 className='truncate text-sm font-medium'>{t('Sessions')}</h2>
          <p className='text-muted-foreground text-xs'>
            {t('{{count}} local sessions', { count: sessions.length })}
          </p>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            variant='outline'
            size='icon-sm'
            onClick={onCreateSession}
            aria-label={t('New session')}
          >
            <PlusIcon className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={onToggleCollapsed}
            aria-label={t('Collapse sessions')}
          >
            <PanelLeftCloseIcon className='size-4' />
          </Button>
        </div>
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        <div className='space-y-1 p-2'>
          {sessions.map((session) => {
            const active = session.id === activeSessionId
            const userMessages = session.messages.filter(
              (message) => message.from === 'user'
            ).length
            return (
              <div
                key={session.id}
                className={cn(
                  'group/session flex items-start gap-2 rounded-md border border-transparent px-2 py-2 transition-colors',
                  active
                    ? 'border-border bg-muted'
                    : 'hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <button
                  type='button'
                  className='min-w-0 flex-1 text-left'
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className='flex items-center gap-2'>
                    <MessageSquareIcon className='text-muted-foreground size-3.5 shrink-0' />
                    <span className='truncate text-sm font-medium'>
                      {session.title || t('New session')}
                    </span>
                  </div>
                  <div className='text-muted-foreground mt-1 flex items-center gap-2 pl-5 text-xs'>
                    <span>{formatSessionTime(session.updatedAt)}</span>
                    <span>
                      {t('{{count}} messages', { count: userMessages })}
                    </span>
                  </div>
                </button>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  className='opacity-0 group-hover/session:opacity-100'
                  onClick={() => onDeleteSession(session.id)}
                  aria-label={t('Delete session')}
                >
                  <Trash2Icon className='size-3.5' />
                </Button>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </aside>
  )
}
