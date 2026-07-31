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

import type {
  RecoveryProbeListParams,
  RecoveryProbeListResponse,
} from './types'

export async function getRecoveryProbes(
  params: RecoveryProbeListParams
): Promise<RecoveryProbeListResponse> {
  const response = await api.get('/api/channel/recovery', { params })
  return response.data
}

export async function probeRecoveryNow(
  channelId: number,
  keyIndex: number
): Promise<{ success: boolean; message?: string }> {
  const response = await api.post(
    `/api/channel/recovery/${channelId}/${keyIndex}/probe`,
    undefined,
    { skipBusinessError: true, skipErrorHandler: true }
  )
  return response.data
}

export async function resetRecoveryProbe(
  channelId: number,
  keyIndex: number
): Promise<{ success: boolean; message?: string }> {
  const response = await api.post(
    `/api/channel/recovery/${channelId}/${keyIndex}/reset`,
    undefined,
    { skipBusinessError: true, skipErrorHandler: true }
  )
  return response.data
}
