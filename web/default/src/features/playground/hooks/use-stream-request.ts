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
import { useCallback, useRef, useState } from 'react'
import { SSE } from 'sse.js'
import { getCommonHeaders } from '@/lib/api'
import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants'
import type { ChatCompletionRequest, ChatCompletionChunk } from '../types'

/**
 * Hook for handling streaming chat completion requests
 */
export function useStreamRequest() {
  const sourcesRef = useRef(
    new Map<string, { source: SSE; isComplete: boolean }>()
  )
  const [activeStreams, setActiveStreams] = useState(0)

  const syncActiveStreams = useCallback(() => {
    setActiveStreams(sourcesRef.current.size)
  }, [])

  const sendStreamRequest = useCallback(
    (
      payload: ChatCompletionRequest,
      onUpdate: (type: 'reasoning' | 'content', chunk: string) => void,
      onComplete: () => void,
      onError: (error: string, errorCode?: string) => void,
      requestId = 'default'
    ) => {
      const existing = sourcesRef.current.get(requestId)
      if (existing) {
        existing.source.close()
        sourcesRef.current.delete(requestId)
      }

      const source = new SSE(API_ENDPOINTS.CHAT_COMPLETIONS, {
        headers: getCommonHeaders(),
        method: 'POST',
        payload: JSON.stringify(payload),
      })

      sourcesRef.current.set(requestId, { source, isComplete: false })
      syncActiveStreams()

      const closeSource = () => {
        source.close()
        const current = sourcesRef.current.get(requestId)
        if (current?.source === source) {
          sourcesRef.current.delete(requestId)
          syncActiveStreams()
        }
      }

      const handleError = (errorMessage: string, errorCode?: string) => {
        const current = sourcesRef.current.get(requestId)
        if (!current?.isComplete) {
          onError(errorMessage, errorCode)
          closeSource()
        }
      }

      source.addEventListener('message', (e: MessageEvent) => {
        if (e.data === '[DONE]') {
          const current = sourcesRef.current.get(requestId)
          if (current) current.isComplete = true
          closeSource()
          onComplete()
          return
        }

        try {
          const chunk: ChatCompletionChunk = JSON.parse(e.data)
          const delta = chunk.choices?.[0]?.delta

          if (delta) {
            if (delta.reasoning_content) {
              onUpdate('reasoning', delta.reasoning_content)
            }
            if (delta.content) {
              onUpdate('content', delta.content)
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to parse SSE message:', error)
          handleError(ERROR_MESSAGES.PARSE_ERROR)
        }
      })

      source.addEventListener('error', (e: Event & { data?: string }) => {
        // Only handle errors if stream didn't complete normally
        if (source.readyState !== 2) {
          // eslint-disable-next-line no-console
          console.error('SSE Error:', e)
          let errorMessage = e.data || ERROR_MESSAGES.API_REQUEST_ERROR
          let errorCode: string | undefined
          if (e.data) {
            try {
              const parsed = JSON.parse(e.data) as {
                error?: { message?: string; code?: string }
              }
              if (parsed?.error) {
                errorMessage = parsed.error.message || errorMessage
                errorCode = parsed.error.code || undefined
              }
            } catch {
              // not JSON, use raw string
            }
          }
          handleError(errorMessage, errorCode)
        }
      })

      source.addEventListener(
        'readystatechange',
        (e: Event & { readyState?: number }) => {
          const status = (source as unknown as { status?: number }).status
          if (
            e.readyState !== undefined &&
            e.readyState >= 2 &&
            status !== undefined &&
            status !== 200
          ) {
            handleError(`HTTP ${status}: ${ERROR_MESSAGES.CONNECTION_CLOSED}`)
          }
        }
      )

      try {
        source.stream()
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('Failed to start SSE stream:', error)
        onError(ERROR_MESSAGES.STREAM_START_ERROR)
        closeSource()
      }
    },
    [syncActiveStreams]
  )

  const stopStream = useCallback(
    (requestId?: string) => {
      if (requestId) {
        const current = sourcesRef.current.get(requestId)
        if (current) {
          current.source.close()
          sourcesRef.current.delete(requestId)
          syncActiveStreams()
        }
        return
      }

      sourcesRef.current.forEach(({ source }) => source.close())
      sourcesRef.current.clear()
      syncActiveStreams()
    },
    [syncActiveStreams]
  )

  const activeStreamIds = useCallback(() => {
    return Array.from(sourcesRef.current.keys())
  }, [])

  return {
    sendStreamRequest,
    stopStream,
    activeStreamIds,
    isStreaming: activeStreams > 0,
  }
}
