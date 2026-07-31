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
export const recoveryProbeStates = [
  'auto_disabled',
  'fast_probing',
  'watching',
  'probation',
  'enabled',
  'parked',
] as const

export type RecoveryProbeState = (typeof recoveryProbeStates)[number]

export type RecoveryProbe = {
  id: number
  channel_id: number
  key_index: number
  channel_name: string
  channel_type: number
  channel_status: number
  channel_priority: number
  state: RecoveryProbeState
  disable_reason_code: string
  disable_reason: string
  failure_streak: number
  success_streak: number
  disabled_at: number
  next_probe_at: number
  last_probe_at: number
  last_latency_ms: number
  daily_probe_count: number
  probe_count_date: string
  lease_until: number
  lease_owner: string
  last_error: string
  last_cancel_reason: string
  updated_at: number
}

export type RecoveryProbeListResponse = {
  success: boolean
  message?: string
  data: {
    items: RecoveryProbe[]
    total: number
    page: number
    page_size: number
    counts: Partial<Record<RecoveryProbeState, number>>
  }
}

export type RecoveryProbeListParams = {
  page: number
  page_size: number
  state?: RecoveryProbeState
  channel_id?: number
}
