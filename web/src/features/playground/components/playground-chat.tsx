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
import { useEffect, useMemo, useState } from 'react'
import { GitCompareIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Branch,
  BranchMessages,
  BranchNext,
  BranchPage,
  BranchPrevious,
  BranchSelector,
} from '@/components/ai-elements/branch'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import { Message, MessageContent } from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Response } from '@/components/ai-elements/response'
import { Shimmer } from '@/components/ai-elements/shimmer'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { MESSAGE_ROLES, MESSAGE_STATUS } from '../constants'
import { getMessageContentStyles } from '../lib/message/message-styles'
import { parseThinkTags } from '../lib/message-utils'
import type { Message as MessageType } from '../types'
import { MessageActions } from './message/message-actions'
import { MessageError } from './message/message-error'

interface PlaygroundChatProps {
  messages: MessageType[]
  onCopyMessage?: (message: MessageType) => void
  onRegenerateMessage?: (message: MessageType) => void
  onEditMessage?: (message: MessageType) => void
  onDeleteMessage?: (message: MessageType) => void
  isGenerating?: boolean
  editingKey?: string | null
  onSaveEdit?: (newContent: string) => void
  onCancelEdit?: (open: boolean) => void
  onSaveEditAndSubmit?: (newContent: string) => void
}

type DisplayItem =
  | {
      type: 'message'
      key: string
      index: number
      message: MessageType
    }
  | {
      type: 'compare'
      key: string
      index: number
      messages: MessageType[]
    }

export function PlaygroundChat({
  messages,
  onCopyMessage,
  onRegenerateMessage,
  onEditMessage,
  onDeleteMessage,
  isGenerating = false,
  editingKey,
  onSaveEdit,
  onCancelEdit,
  onSaveEditAndSubmit,
}: PlaygroundChatProps) {
  const { t } = useTranslation()
  const [editText, setEditText] = useState('')
  const [originalText, setOriginalText] = useState('')

  useEffect(() => {
    if (!editingKey) return
    const message = messages.find((m) => m.key === editingKey)
    const content = message?.versions?.[0]?.content || ''
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditText(content)

    setOriginalText(content)
  }, [editingKey, messages])

  const isEditing = (key: string) => editingKey === key
  const isEmpty = useMemo(() => !editText.trim(), [editText])
  const isChanged = useMemo(
    () => editText !== originalText,
    [editText, originalText]
  )

  const displayItems = useMemo<DisplayItem[]>(() => {
    const handledCompareGroups = new Set<string>()
    const items: DisplayItem[] = []

    messages.forEach((message, index) => {
      if (
        message.from === MESSAGE_ROLES.ASSISTANT &&
        message.compareGroupId
      ) {
        if (handledCompareGroups.has(message.compareGroupId)) return
        handledCompareGroups.add(message.compareGroupId)
        items.push({
          type: 'compare',
          key: message.compareGroupId,
          index,
          messages: messages.filter(
            (item) => item.compareGroupId === message.compareGroupId
          ),
        })
        return
      }

      items.push({ type: 'message', key: message.key, index, message })
    })

    return items
  }, [messages])

  const renderMessageBody = (
    message: MessageType,
    version: MessageType['versions'][number],
    isLastAssistantMessage: boolean,
    compact = false
  ) => {
    const isAssistant = message.from === MESSAGE_ROLES.ASSISTANT
    const hasSources = !!message.sources?.length
    const showReasoning = isAssistant && !!message.reasoning?.content
    const showLoader =
      isAssistant &&
      !message.isReasoningStreaming &&
      (message.status === MESSAGE_STATUS.LOADING ||
        (message.status === MESSAGE_STATUS.STREAMING && !version.content))
    const showMessageContent =
      (message.from === MESSAGE_ROLES.USER || !message.isReasoningStreaming) &&
      !!version.content
    const displayContent = isAssistant
      ? parseThinkTags(version.content).visibleContent
      : version.content

    const actions = (
      <MessageActions
        message={message}
        onCopy={onCopyMessage}
        onRegenerate={onRegenerateMessage}
        onEdit={onEditMessage}
        onDelete={onDeleteMessage}
        isGenerating={isGenerating}
        alwaysVisible={isLastAssistantMessage || compact}
        className='mt-1'
      />
    )

    return (
      <>
        {hasSources && (
          <Sources>
            <SourcesTrigger count={message.sources!.length} />
            <SourcesContent>
              {message.sources!.map((source, sourceIndex) => (
                <Source
                  href={source.href}
                  key={`${message.key}-source-${sourceIndex}`}
                  title={source.title}
                />
              ))}
            </SourcesContent>
          </Sources>
        )}

        {showReasoning && (
          <Reasoning
            defaultOpen={true}
            isStreaming={message.isReasoningStreaming}
          >
            <ReasoningTrigger />
            <ReasoningContent>{message.reasoning!.content}</ReasoningContent>
          </Reasoning>
        )}

        {showLoader && (
          <div className='flex items-center gap-2 py-2'>
            <Loader />
            <Shimmer className='text-sm' duration={1}>
              {t('Responding...')}
            </Shimmer>
          </div>
        )}

        {message.status === MESSAGE_STATUS.ERROR ? (
          <>
            <MessageError message={message} className='mb-2' />
            {actions}
          </>
        ) : (
          showMessageContent && (
            <>
              <MessageContent
                variant='flat'
                className={cn(getMessageContentStyles(), compact && 'text-sm')}
              >
                <Response>{displayContent}</Response>
              </MessageContent>
              {actions}
            </>
          )
        )}
      </>
    )
  }

  return (
    <Conversation>
      {/* Remove outer padding; apply padding to inner centered container to align with input */}
      <ConversationContent className='p-0'>
        <div className='mx-auto w-full max-w-4xl px-4 py-4'>
          {displayItems.map((item) => {
            if (item.type === 'compare') {
              const compareMessages = item.messages
              return (
                <div key={item.key} className='group py-2'>
                  <div className='mb-2 flex items-center gap-2'>
                    <GitCompareIcon className='text-muted-foreground size-4' />
                    <span className='text-sm font-medium'>
                      {t('Model comparison')}
                    </span>
                    <Badge variant='outline' className='rounded-md'>
                      {t('{{count}} models', {
                        count: compareMessages.length,
                      })}
                    </Badge>
                  </div>
                  <div className='overflow-x-auto pb-2'>
                    <div className='grid min-w-max auto-cols-[minmax(280px,1fr)] grid-flow-col gap-3 lg:min-w-0 lg:grid-flow-row lg:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]'>
                      {compareMessages.map((message) => {
                        const version = message.versions[0]
                        const isLoading =
                          message.status === MESSAGE_STATUS.LOADING ||
                          message.status === MESSAGE_STATUS.STREAMING
                        return (
                          <div
                            key={message.key}
                            className='bg-background flex min-h-40 min-w-0 flex-col rounded-lg border'
                          >
                            <div className='bg-muted/40 flex min-w-0 items-center justify-between gap-2 border-b px-3 py-2'>
                              <div className='min-w-0'>
                                <div className='truncate text-sm font-medium'>
                                  {message.model || t('Model')}
                                </div>
                                <div className='text-muted-foreground text-xs'>
                                  {isLoading ? t('Generating') : t('Complete')}
                                </div>
                              </div>
                              <Badge
                                variant={isLoading ? 'secondary' : 'outline'}
                                className='rounded-md'
                              >
                                {isLoading ? t('Live') : t('Done')}
                              </Badge>
                            </div>
                            <div className='min-w-0 flex-1 px-3 py-3'>
                              {version &&
                                renderMessageBody(message, version, false, true)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            }

            const message = item.message
            const messageIndex = item.index
            const { versions = [] } = message
            const isLastAssistantMessage =
              messageIndex === messages.length - 1 &&
              message.from === MESSAGE_ROLES.ASSISTANT
            return (
              <Branch defaultBranch={0} key={message.key}>
                <BranchMessages>
                  {versions.map((version, versionIndex) => (
                    <Message
                      className='group flex-row-reverse'
                      from={message.from}
                      key={`${message.key}-${version.id}-${versionIndex}`}
                    >
                      <div className='w-full min-w-0 flex-1 basis-full py-1'>
                        {isEditing(message.key) ? (
                          <div className='space-y-2'>
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className='font-mono text-sm'
                              rows={8}
                            />
                            <div className='flex gap-2'>
                              {/* Save & Submit only makes sense for user messages */}
                              {message.from === MESSAGE_ROLES.USER && (
                                <Button
                                  size='sm'
                                  onClick={() =>
                                    onSaveEditAndSubmit?.(editText)
                                  }
                                  disabled={isEmpty || !isChanged}
                                >
                                  Save & Submit
                                </Button>
                              )}
                              <Button
                                size='sm'
                                onClick={() => onSaveEdit?.(editText)}
                                disabled={isEmpty || !isChanged}
                              >
                                Save
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                onClick={() => onCancelEdit?.(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(() => {
                              return renderMessageBody(
                                message,
                                version,
                                isLastAssistantMessage
                              )
                            })()}
                          </>
                        )}
                      </div>
                    </Message>
                  ))}
                </BranchMessages>

                {/* Branch selector for multiple versions */}
                {versions.length > 1 && (
                  <BranchSelector className='px-0' from={message.from}>
                    <BranchPrevious />
                    <BranchPage />
                    <BranchNext />
                  </BranchSelector>
                )}
              </Branch>
            )
          })}
        </div>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
