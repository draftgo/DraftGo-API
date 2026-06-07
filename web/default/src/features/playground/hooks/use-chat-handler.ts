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
import { useCallback } from 'react'
import { toast } from 'sonner'
import { sendChatCompletion } from '../api'
import { MESSAGE_STATUS, ERROR_MESSAGES } from '../constants'
import {
  buildChatCompletionPayload,
  updateAssistantMessageByKey,
  updateAssistantMessageWithError,
  updateLastAssistantMessage,
  processStreamingContent,
  finalizeMessage,
} from '../lib'
import type { Message, PlaygroundConfig, ParameterEnabled } from '../types'
import { useStreamRequest } from './use-stream-request'

interface UseChatHandlerOptions {
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
}

type CompareTarget = {
  model: string
  assistantMessageKey: string
}

function getMessagesForModel(messages: Message[], model?: string) {
  if (!model) return messages

  return messages.filter(
    (message) =>
      message.from !== 'assistant' ||
      !message.compareGroupId ||
      message.model === model
  )
}

function updateTargetAssistantMessage(
  messages: Message[],
  assistantMessageKey: string | undefined,
  updater: (message: Message) => Message
) {
  return assistantMessageKey
    ? updateAssistantMessageByKey(messages, assistantMessageKey, updater)
    : updateLastAssistantMessage(messages, updater)
}

/**
 * Hook for handling chat message sending and receiving.
 */
export function useChatHandler({
  config,
  parameterEnabled,
  onMessageUpdate,
}: UseChatHandlerOptions) {
  const { sendStreamRequest, stopStream, activeStreamIds, isStreaming } =
    useStreamRequest()

  const getConfigForModel = useCallback(
    (model?: string): PlaygroundConfig => ({
      ...config,
      model: model ?? config.model,
    }),
    [config]
  )

  const handleStreamUpdate = useCallback(
    (
      type: 'reasoning' | 'content',
      chunk: string,
      assistantMessageKey?: string
    ) => {
      onMessageUpdate((prev) =>
        updateTargetAssistantMessage(prev, assistantMessageKey, (message) => {
          if (message.status === MESSAGE_STATUS.ERROR) return message

          if (type === 'reasoning') {
            return {
              ...message,
              reasoning: {
                content: (message.reasoning?.content || '') + chunk,
                duration: 0,
              },
              isReasoningStreaming: true,
              status: MESSAGE_STATUS.STREAMING,
            }
          }

          return {
            ...processStreamingContent(message, chunk),
            status: MESSAGE_STATUS.STREAMING,
          }
        })
      )
    },
    [onMessageUpdate]
  )

  const handleStreamComplete = useCallback(
    (assistantMessageKey?: string) => {
      onMessageUpdate((prev) =>
        updateTargetAssistantMessage(prev, assistantMessageKey, (message) =>
          message.status === MESSAGE_STATUS.COMPLETE ||
          message.status === MESSAGE_STATUS.ERROR
            ? message
            : { ...finalizeMessage(message), status: MESSAGE_STATUS.COMPLETE }
        )
      )
    },
    [onMessageUpdate]
  )

  const handleStreamError = useCallback(
    (error: string, errorCode?: string, assistantMessageKey?: string) => {
      toast.error(error)
      onMessageUpdate((prev) =>
        updateAssistantMessageWithError(
          prev,
          error,
          errorCode,
          assistantMessageKey
        )
      )
    },
    [onMessageUpdate]
  )

  const sendStreamingChat = useCallback(
    (messages: Message[], model?: string, assistantMessageKey?: string) => {
      const payload = buildChatCompletionPayload(
        getMessagesForModel(messages, model),
        getConfigForModel(model),
        parameterEnabled
      )
      const requestId = assistantMessageKey ?? 'default'

      sendStreamRequest(
        payload,
        (type, chunk) => handleStreamUpdate(type, chunk, assistantMessageKey),
        () => handleStreamComplete(assistantMessageKey),
        (error, errorCode) =>
          handleStreamError(error, errorCode, assistantMessageKey),
        requestId
      )
    },
    [
      getConfigForModel,
      parameterEnabled,
      sendStreamRequest,
      handleStreamUpdate,
      handleStreamComplete,
      handleStreamError,
    ]
  )

  const sendNonStreamingChat = useCallback(
    async (messages: Message[], model?: string, assistantMessageKey?: string) => {
      const payload = buildChatCompletionPayload(
        getMessagesForModel(messages, model),
        getConfigForModel(model),
        parameterEnabled
      )

      try {
        const response = await sendChatCompletion(payload)
        const choice = response.choices?.[0]
        if (!choice) return

        onMessageUpdate((prev) =>
          updateTargetAssistantMessage(prev, assistantMessageKey, (message) => ({
            ...finalizeMessage(
              {
                ...message,
                versions: [
                  {
                    ...message.versions[0],
                    content: choice.message?.content || '',
                  },
                ],
              },
              choice.message?.reasoning_content
            ),
            status: MESSAGE_STATUS.COMPLETE,
          }))
        )
      } catch (error: unknown) {
        const err = error as {
          response?: {
            data?: { message?: string; error?: { code?: string } }
          }
          message?: string
        }
        handleStreamError(
          err?.response?.data?.message ||
            err?.message ||
            ERROR_MESSAGES.API_REQUEST_ERROR,
          err?.response?.data?.error?.code || undefined,
          assistantMessageKey
        )
      }
    },
    [
      getConfigForModel,
      parameterEnabled,
      onMessageUpdate,
      handleStreamError,
    ]
  )

  const sendChat = useCallback(
    (messages: Message[], model?: string, assistantMessageKey?: string) => {
      if (config.stream) {
        sendStreamingChat(messages, model, assistantMessageKey)
      } else {
        sendNonStreamingChat(messages, model, assistantMessageKey)
      }
    },
    [config.stream, sendStreamingChat, sendNonStreamingChat]
  )

  const sendCompareChat = useCallback(
    (messages: Message[], targets: CompareTarget[]) => {
      targets.forEach((target) => {
        sendChat(messages, target.model, target.assistantMessageKey)
      })
    },
    [sendChat]
  )

  const stopGeneration = useCallback(() => {
    const streamIds = activeStreamIds()
    stopStream()
    onMessageUpdate((prev) =>
      prev.map((message) =>
        message.from === 'assistant' &&
        (message.status === MESSAGE_STATUS.LOADING ||
          message.status === MESSAGE_STATUS.STREAMING) &&
        (streamIds.length === 0 || streamIds.includes(message.key))
          ? { ...finalizeMessage(message), status: MESSAGE_STATUS.COMPLETE }
          : message
      )
    )
  }, [activeStreamIds, stopStream, onMessageUpdate])

  return {
    sendChat,
    sendCompareChat,
    stopGeneration,
    isGenerating: isStreaming,
  }
}
