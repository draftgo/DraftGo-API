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
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { getSelf } from '@/lib/api'

let sessionVerified = false
let pendingSessionLoad: Promise<AuthUser | null> | null = null

export function markSessionUnverified() {
  sessionVerified = false
}

export async function loadCurrentUser(options?: {
  force?: boolean
}): Promise<AuthUser | null> {
  const { auth } = useAuthStore.getState()

  if (!options?.force && auth.user && sessionVerified) {
    return auth.user
  }

  if (!options?.force && pendingSessionLoad) {
    return pendingSessionLoad
  }

  pendingSessionLoad = getSelf()
    .then((res) => {
      if (res?.success && res.data) {
        auth.setUser(res.data)
        sessionVerified = true
        return res.data as AuthUser
      }

      auth.reset()
      sessionVerified = false
      return null
    })
    .catch(() => {
      auth.reset()
      sessionVerified = false
      return null
    })
    .finally(() => {
      pendingSessionLoad = null
    })

  return pendingSessionLoad
}
