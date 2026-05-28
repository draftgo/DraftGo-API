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
import { useSearch } from '@tanstack/react-router'
import { PublicLayout } from '@/components/layout'
import { useStatus } from '@/hooks/use-status'
import { parseCustomNavLinks } from '@/features/system-settings/maintenance/header-custom-links-section'

export function EmbedPage() {
  const { url, idx, title, type } = useSearch({ from: '/embed/' }) as {
    url?: string
    idx?: string
    title?: string
    type?: 'link' | 'html'
  }

  const { status } = useStatus()

  const htmlContent = useMemo(() => {
    if (type !== 'html' || idx == null) return null
    const customLinksRaw = (status as Record<string, unknown> | null)
      ?.HeaderNavCustomLinks as string | undefined
    const customLinks = parseCustomNavLinks(customLinksRaw)
    const index = parseInt(idx, 10)
    if (isNaN(index) || index < 0 || index >= customLinks.length) return null
    return customLinks[index]?.url || null
  }, [type, idx, status])

  const content = type === 'html' ? htmlContent : url

  if (!content) {
    return (
      <PublicLayout>
        <div className='flex h-[60vh] items-center justify-center'>
          <p className='text-muted-foreground'>No content to display</p>
        </div>
      </PublicLayout>
    )
  }

  if (type === 'html') {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='h-[calc(100svh-4rem)] pt-16'>
          <iframe
            srcDoc={content}
            title={title || 'Embedded content'}
            className='h-full w-full border-0'
            sandbox='allow-scripts allow-same-origin allow-popups allow-forms'
          />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='h-[calc(100svh-4rem)] pt-16'>
        <iframe
          src={content}
          title={title || 'Embedded content'}
          className='h-full w-full border-0'
          sandbox='allow-scripts allow-same-origin allow-popups allow-forms'
          referrerPolicy='no-referrer'
        />
      </div>
    </PublicLayout>
  )
}
