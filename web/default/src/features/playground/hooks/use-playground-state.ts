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
import { useState, useCallback, useMemo } from 'react'
import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../constants'
import {
  createPlaygroundSession,
  createQuickPrompt,
  getPlaygroundSessionTitle,
  loadActiveSessionId,
  loadQuickPrompts,
  loadSessionListCollapsed,
  loadSessions,
  saveActiveSessionId,
  saveQuickPrompts,
  saveSessionListCollapsed,
  saveSessions,
} from '../lib'
import type {
  Message,
  PlaygroundConfig,
  ParameterEnabled,
  ModelOption,
  GroupOption,
  PlaygroundSession,
  QuickPrompt,
} from '../types'

function getInitialState() {
  const sessions = loadSessions()
  const savedActiveSessionId = loadActiveSessionId()
  const activeSessionId =
    sessions.find((session) => session.id === savedActiveSessionId)?.id ??
    sessions[0].id

  saveSessions(sessions)
  saveActiveSessionId(activeSessionId)

  return {
    sessions,
    activeSessionId,
    quickPrompts: loadQuickPrompts(),
    sessionListCollapsed: loadSessionListCollapsed(),
  }
}

/**
 * Main state management hook for playground.
 */
export function usePlaygroundState() {
  const [initialState] = useState(getInitialState)
  const [sessions, setSessions] = useState<PlaygroundSession[]>(
    initialState.sessions
  )
  const [activeSessionId, setActiveSessionId] = useState(
    initialState.activeSessionId
  )
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>(
    initialState.quickPrompts
  )
  const [sessionListCollapsed, setSessionListCollapsed] = useState(
    initialState.sessionListCollapsed
  )
  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ??
      sessions[0] ??
      createPlaygroundSession(),
    [sessions, activeSessionId]
  )

  const persistSessions = useCallback((nextSessions: PlaygroundSession[]) => {
    saveSessions(nextSessions)
    return nextSessions
  }, [])

  const updateActiveSession = useCallback(
    (updater: (session: PlaygroundSession) => PlaygroundSession) => {
      setSessions((prev) =>
        persistSessions(
          prev.map((session) =>
            session.id === activeSessionId ? updater(session) : session
          )
        )
      )
    },
    [activeSessionId, persistSessions]
  )

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
    saveActiveSessionId(sessionId)
  }, [])

  const createSession = useCallback(() => {
    const session = createPlaygroundSession({
      config: activeSession?.config,
      parameterEnabled: activeSession?.parameterEnabled,
    })
    setSessions((prev) => persistSessions([session, ...prev]))
    setActiveSessionId(session.id)
    saveActiveSessionId(session.id)
  }, [activeSession?.config, activeSession?.parameterEnabled, persistSessions])

  const deleteSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => {
        if (prev.length <= 1) {
          const replacement = createPlaygroundSession()
          setActiveSessionId(replacement.id)
          saveActiveSessionId(replacement.id)
          return persistSessions([replacement])
        }

        const index = prev.findIndex((session) => session.id === sessionId)
        const next = prev.filter((session) => session.id !== sessionId)

        if (sessionId === activeSessionId) {
          const fallback = next[Math.max(0, index - 1)] ?? next[0]
          setActiveSessionId(fallback.id)
          saveActiveSessionId(fallback.id)
        }

        return persistSessions(next)
      })
    },
    [activeSessionId, persistSessions]
  )

  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      updateActiveSession((session) => ({
        ...session,
        updatedAt: Date.now(),
        config: { ...session.config, [key]: value },
      }))
    },
    [updateActiveSession]
  )

  const updateParameterEnabled = useCallback(
    (key: keyof ParameterEnabled, value: boolean) => {
      updateActiveSession((session) => ({
        ...session,
        updatedAt: Date.now(),
        parameterEnabled: { ...session.parameterEnabled, [key]: value },
      }))
    },
    [updateActiveSession]
  )

  const updateMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      updateActiveSession((session) => {
        const newMessages =
          typeof updater === 'function' ? updater(session.messages) : updater
        return {
          ...session,
          title: getPlaygroundSessionTitle(newMessages),
          updatedAt: Date.now(),
          messages: newMessages,
        }
      })
    },
    [updateActiveSession]
  )

  const clearMessages = useCallback(() => {
    updateMessages([])
  }, [updateMessages])

  const resetConfig = useCallback(() => {
    updateActiveSession((session) => ({
      ...session,
      updatedAt: Date.now(),
      config: DEFAULT_CONFIG,
      parameterEnabled: DEFAULT_PARAMETER_ENABLED,
    }))
  }, [updateActiveSession])

  const updateQuickPrompts = useCallback(
    (updater: QuickPrompt[] | ((prev: QuickPrompt[]) => QuickPrompt[])) => {
      setQuickPrompts((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        saveQuickPrompts(next)
        return next
      })
    },
    []
  )

  const addQuickPrompt = useCallback(() => {
    const prompt = createQuickPrompt()
    updateQuickPrompts((prev) => [...prev, prompt])
    return prompt
  }, [updateQuickPrompts])

  const toggleSessionList = useCallback(() => {
    setSessionListCollapsed((prev) => {
      const next = !prev
      saveSessionListCollapsed(next)
      return next
    })
  }, [])

  return {
    activeSessionId,
    config: activeSession.config,
    parameterEnabled: activeSession.parameterEnabled,
    messages: activeSession.messages,
    sessions,
    sessionListCollapsed,
    quickPrompts,
    models,
    groups,
    setModels,
    setGroups,
    selectSession,
    createSession,
    deleteSession,
    updateConfig,
    updateParameterEnabled,
    updateMessages,
    clearMessages,
    resetConfig,
    updateQuickPrompts,
    addQuickPrompt,
    toggleSessionList,
  }
}
