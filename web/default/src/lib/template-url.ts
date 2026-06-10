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
import { api } from '@/lib/api'

export const ACCESS_TOKEN_TEMPLATE = '{token}'

let accessTokenCache = ''
let accessTokenCacheUserId = ''
let accessTokenPromise: Promise<string> | null = null

export function templateNeedsAccessToken(value: string | null | undefined) {
  return !!value && value.includes(ACCESS_TOKEN_TEMPLATE)
}

export async function getCurrentAccessToken(): Promise<string> {
  const userId = getStoredUserId()
  if (accessTokenCache && accessTokenCacheUserId === userId) {
    return accessTokenCache
  }
  if (accessTokenPromise) return accessTokenPromise

  accessTokenPromise = api
    .get('/api/user/token/current', {
      disableDuplicate: true,
      skipBusinessError: true,
      skipErrorHandler: true,
    })
    .then((res) => {
      const token =
        res.data?.success && typeof res.data?.data === 'string'
          ? res.data.data
          : ''
      accessTokenCache = token
      accessTokenCacheUserId = userId
      return token
    })
    .catch(() => '')
    .finally(() => {
      accessTokenPromise = null
    })

  return accessTokenPromise
}

export function resolveTemplateUrl(
  template: string,
  status: Record<string, unknown> | null | undefined,
  accessToken = ''
): string {
  let url = template
  const serverAddress = (status?.server_address as string) || ''

  if (url.includes('{address}')) {
    url = url.split('{address}').join(encodeURIComponent(serverAddress))
  }

  if (url.includes('{key}')) {
    url = url.split('{key}').join(getStoredApiKey())
  }

  if (url.includes(ACCESS_TOKEN_TEMPLATE)) {
    url = url.split(ACCESS_TOKEN_TEMPLATE).join(accessToken)
  }

  return url
}

function getStoredApiKey(): string {
  try {
    const stored = localStorage.getItem('user')
    if (!stored) return ''
    const parsed = JSON.parse(stored)
    const token = parsed?.token || parsed?.key || ''
    if (!token) return ''
    return token.startsWith('sk-') ? token : `sk-${token}`
  } catch {
    return ''
  }
}

function getStoredUserId(): string {
  try {
    return localStorage.getItem('uid') || ''
  } catch {
    return ''
  }
}
