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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { parseHeaderNavModulesFromStatus } from '@/lib/nav-modules'
import { parseCustomNavLinks } from '@/features/system-settings/maintenance/header-custom-links-section'
import { useStatus } from '@/hooks/use-status'

export type TopNavLink = {
  title: string
  href: string
  disabled?: boolean
  requiresAuth?: boolean
  external?: boolean
}

/**
 * Generate top navigation links based on HeaderNavModules configuration from backend /api/status
 * Backend format example (stringified JSON):
 * {
 *   home: true,
 *   console: true,
 *   pricing: { enabled: true, requireAuth: false },
 *   rankings: { enabled: true, requireAuth: false },
 *   docs: true,
 *   about: true
 * }
 */
export function useTopNavLinks(): TopNavLink[] {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { auth } = useAuthStore()

  // Parse HeaderNavModules
  const modules = useMemo(() => {
    return parseHeaderNavModulesFromStatus(
      status as Record<string, unknown> | null
    )
  }, [status])

  // Documentation link (may be external)
  const docsLink: string | undefined = status?.docs_link as string | undefined

  const isAuthed = !!auth?.user

  const links: TopNavLink[] = []

  // Home
  if (modules?.home !== false) {
    links.push({ title: t('Home'), href: '/' })
  }

  // Console -> /dashboard (new console path)
  if (modules?.console !== false) {
    links.push({ title: t('Console'), href: '/dashboard' })
  }

  // Pricing
  const pricing = modules?.pricing
  if (pricing && typeof pricing === 'object' && pricing.enabled) {
    const requiresAuth = pricing.requireAuth && !isAuthed
    links.push({ title: t('Model Square'), href: '/pricing', requiresAuth })
  }

  // Rankings
  const rankings = modules?.rankings
  if (rankings && typeof rankings === 'object' && rankings.enabled) {
    const requiresAuth = rankings.requireAuth && !isAuthed
    links.push({ title: t('Rankings'), href: '/rankings', requiresAuth })
  }

  // Docs (supports external links)
  if (modules?.docs !== false) {
    if (docsLink) {
      links.push({ title: t('Docs'), href: docsLink, external: true })
    } else {
      links.push({ title: t('Docs'), href: '/docs' })
    }
  }

  // About
  if (modules?.about !== false) {
    links.push({ title: t('About'), href: '/about' })
  }

  // Custom links from HeaderNavCustomLinks
  const customLinksRaw = (status as Record<string, unknown> | null)
    ?.HeaderNavCustomLinks as string | undefined
  const customLinks = parseCustomNavLinks(customLinksRaw)

  for (const link of customLinks) {
    if (!link.title.trim() || !link.url.trim()) continue
    const resolvedUrl = resolveNavLinkUrl(link.url, status)

    if (link.showNav) {
      if (link.type === 'html') {
        const idx = customLinks.indexOf(link)
        const embedParams = new URLSearchParams({
          idx: String(idx),
          title: link.title,
          type: 'html',
        })
        links.push({
          title: link.title,
          href: `/embed/?${embedParams.toString()}`,
          external: false,
        })
      } else {
        const embedParams = new URLSearchParams({
          url: resolvedUrl,
          title: link.title,
          type: 'link',
        })
        links.push({
          title: link.title,
          href: `/embed/?${embedParams.toString()}`,
          external: false,
        })
      }
    } else {
      links.push({
        title: link.title,
        href: resolvedUrl,
        external: link.external,
      })
    }
  }

  return links
}

function resolveNavLinkUrl(
  template: string,
  status: Record<string, unknown> | null | undefined
): string {
  let url = template
  const serverAddress = (status?.server_address as string) || ''

  if (url.includes('{address}')) {
    url = url.split('{address}').join(encodeURIComponent(serverAddress))
  }

  if (url.includes('{key}')) {
    let apiKey = ''
    try {
      const stored = localStorage.getItem('user')
      if (stored) {
        const parsed = JSON.parse(stored)
        const token = parsed?.token || parsed?.key || ''
        apiKey = token
          ? token.startsWith('sk-')
            ? token
            : `sk-${token}`
          : ''
      }
    } catch {
      /* empty */
    }
    url = url.split('{key}').join(apiKey)
  }

  return url
}
