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
  DEFAULT_CONFIG,
  DEFAULT_PARAMETER_ENABLED,
  DEFAULT_QUICK_PROMPTS,
  STORAGE_KEYS,
} from '../constants'
import type {
  PlaygroundConfig,
  ParameterEnabled,
  Message,
  PlaygroundSession,
  QuickPrompt,
} from '../types'
import { sanitizeMessagesOnLoad } from './message-utils'

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getPlaygroundSessionTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.from === 'user')
  const content = firstUserMessage?.versions?.[0]?.content.trim()
  if (!content) return '新会话'
  return content.length > 28 ? `${content.slice(0, 28)}...` : content
}

export function createPlaygroundSession(
  overrides: Partial<PlaygroundSession> = {}
): PlaygroundSession {
  const now = Date.now()
  const messages = overrides.messages ?? []
  return {
    id: overrides.id ?? makeId('session'),
    title: overrides.title ?? getPlaygroundSessionTitle(messages),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    config: {
      ...DEFAULT_CONFIG,
      ...(overrides.config ?? {}),
    },
    parameterEnabled: {
      ...DEFAULT_PARAMETER_ENABLED,
      ...(overrides.parameterEnabled ?? {}),
    },
    messages,
  }
}

export function createQuickPrompt(
  overrides: Partial<QuickPrompt> = {}
): QuickPrompt {
  return {
    id: overrides.id ?? makeId('prompt'),
    name: overrides.name?.trim() || '新提示词',
    prompt: overrides.prompt?.trim() || '',
  }
}

/**
 * Load playground config from localStorage
 */
export function loadConfig(): Partial<PlaygroundConfig> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load config:', error)
  }
  return {}
}

/**
 * Save playground config to localStorage
 */
export function saveConfig(config: Partial<PlaygroundConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save config:', error)
  }
}

/**
 * Load parameter enabled state from localStorage
 */
export function loadParameterEnabled(): Partial<ParameterEnabled> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PARAMETER_ENABLED)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load parameter enabled:', error)
  }
  return {}
}

/**
 * Save parameter enabled state to localStorage
 */
export function saveParameterEnabled(
  parameterEnabled: Partial<ParameterEnabled>
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.PARAMETER_ENABLED,
      JSON.stringify(parameterEnabled)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save parameter enabled:', error)
  }
}

/**
 * Load messages from localStorage
 */
export function loadMessages(): Message[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) {
        return null
      }
      const sanitized = sanitizeMessagesOnLoad(parsed as Message[])
      // Persist sanitized result to avoid re-sanitizing on subsequent loads
      if (sanitized !== parsed) {
        saveMessages(sanitized)
      }
      return sanitized
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load messages:', error)
  }
  return null
}

/**
 * Save messages to localStorage
 */
export function saveMessages(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save messages:', error)
  }
}

function loadLegacySession(): PlaygroundSession | null {
  const messages = loadMessages() ?? []
  const config = { ...DEFAULT_CONFIG, ...loadConfig() }
  const parameterEnabled = {
    ...DEFAULT_PARAMETER_ENABLED,
    ...loadParameterEnabled(),
  }

  if (
    messages.length === 0 &&
    Object.keys(loadConfig()).length === 0 &&
    Object.keys(loadParameterEnabled()).length === 0
  ) {
    return null
  }

  return createPlaygroundSession({
    title: getPlaygroundSessionTitle(messages),
    config,
    parameterEnabled,
    messages,
  })
}

export function loadSessions(): PlaygroundSession[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        const sessions = parsed.map((session) => {
          const item = session as Partial<PlaygroundSession>
          return createPlaygroundSession({
            ...item,
            messages: sanitizeMessagesOnLoad(item.messages ?? []),
          })
        })
        if (sessions.length > 0) return sessions
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load sessions:', error)
  }

  const legacySession = loadLegacySession()
  return legacySession ? [legacySession] : [createPlaygroundSession()]
}

export function saveSessions(sessions: PlaygroundSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save sessions:', error)
  }
}

export function loadActiveSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load active session id:', error)
  }
  return null
}

export function saveActiveSessionId(sessionId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, sessionId)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save active session id:', error)
  }
}

export function loadQuickPrompts(): QuickPrompt[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.QUICK_PROMPTS)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => item as Partial<QuickPrompt>)
          .filter((item) => item.name?.trim() && item.prompt?.trim())
          .map((item) => createQuickPrompt(item))
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load quick prompts:', error)
  }

  return DEFAULT_QUICK_PROMPTS.map((prompt) => ({ ...prompt }))
}

export function saveQuickPrompts(prompts: QuickPrompt[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.QUICK_PROMPTS, JSON.stringify(prompts))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save quick prompts:', error)
  }
}

export function loadSessionListCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.SESSION_LIST_COLLAPSED) === 'true'
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load session list state:', error)
  }
  return false
}

export function saveSessionListCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.SESSION_LIST_COLLAPSED,
      collapsed ? 'true' : 'false'
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save session list state:', error)
  }
}

/**
 * Clear all playground data
 */
export function clearPlaygroundData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONFIG)
    localStorage.removeItem(STORAGE_KEYS.PARAMETER_ENABLED)
    localStorage.removeItem(STORAGE_KEYS.MESSAGES)
    localStorage.removeItem(STORAGE_KEYS.SESSIONS)
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID)
    localStorage.removeItem(STORAGE_KEYS.QUICK_PROMPTS)
    localStorage.removeItem(STORAGE_KEYS.SESSION_LIST_COLLAPSED)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear playground data:', error)
  }
}
