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
import i18next from 'i18next'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useStatus } from '@/hooks/use-status'
import { isHttpUrl } from '@/lib/content-format'
import { useAuthStore } from '@/stores/auth-store'
import {
  getCurrentAccessToken,
  resolveTemplateUrl,
  templateNeedsAccessToken,
} from '@/lib/template-url'
import { getHomePageContent } from '../api'
import type { HomePageContentResult } from '../types'

const STORAGE_KEY = 'home_page_content'

/**
 * Hook to load and manage custom home page content
 * Supports both Markdown/HTML content and iframe URLs
 */
export function useHomePageContent(): HomePageContentResult {
  const { auth } = useAuthStore()
  const { status } = useStatus()
  const [rawContent, setRawContent] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [isLoaded, setIsLoaded] = useState(false)
  const [isResolved, setIsResolved] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadContent = async () => {
      // Load from localStorage first for immediate display
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached && mounted) {
        setRawContent(cached)
      }

      try {
        const response = await getHomePageContent()
        const { success, data } = response

        if (!mounted) return

        if (success && data) {
          setRawContent(data)
          localStorage.setItem(STORAGE_KEY, data)
        } else {
          // Clear content if API returns empty
          setRawContent('')
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (error) {
        if (!mounted) return
        // eslint-disable-next-line no-console
        console.error('Failed to load home page content:', error)
        toast.error(i18next.t('Failed to load home page content'))
      } finally {
        if (mounted) {
          setIsLoaded(true)
        }
      }
    }

    loadContent()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const resolveContent = async () => {
      const isUrl = isHttpUrl(rawContent)
      const needsAccessToken = isUrl && templateNeedsAccessToken(rawContent)

      if (!needsAccessToken) {
        setContent(
          isUrl ? resolveTemplateUrl(rawContent, status, '') : rawContent
        )
        setIsResolved(true)
        return
      }

      if (!auth.user) {
        setContent(resolveTemplateUrl(rawContent, status, 'false'))
        setIsResolved(true)
        return
      }

      setIsResolved(false)

      const token = await getCurrentAccessToken()
      if (!mounted) return

      setContent(resolveTemplateUrl(rawContent, status, token || 'false'))
      setIsResolved(true)
    }

    resolveContent()

    return () => {
      mounted = false
    }
  }, [auth.user, rawContent, status])

  const isUrl = isHttpUrl(content)

  return { content, isLoaded: isLoaded && isResolved, isUrl }
}
