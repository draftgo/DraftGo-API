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
import { useQuery } from '@tanstack/react-query'
import { useStatus } from '@/hooks/use-status'
import { getPricing } from '../api'
import type { PricingData, PricingModel, PricingRateLimitConfig } from '../types'

function readStatusValue(status: unknown, key: string): unknown {
  if (!status || typeof status !== 'object') return undefined
  const record = status as Record<string, unknown>
  return (
    record[key] ?? (record.data as Record<string, unknown> | undefined)?.[key]
  )
}

function parseBooleanStatusValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

function parseNumberStatusValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function parseGroupRateLimits(value: unknown): Record<string, [number, number]> {
  if (!value) return {}
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return {}
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }

  const limits: Record<string, [number, number]> = {}
  for (const [group, rawLimits] of Object.entries(
    parsed as Record<string, unknown>
  )) {
    if (
      Array.isArray(rawLimits) &&
      rawLimits.length >= 2 &&
      typeof rawLimits[0] === 'number' &&
      typeof rawLimits[1] === 'number'
    ) {
      limits[group] = [rawLimits[0], rawLimits[1]]
    }
  }
  return limits
}

function normalizePricingData(data: PricingData | undefined) {
  const models = Array.isArray(data?.data) ? data.data : []
  const vendors = Array.isArray(data?.vendors) ? data.vendors : []
  const groupRatio =
    data?.group_ratio && typeof data.group_ratio === 'object'
      ? data.group_ratio
      : {}
  const usableGroup =
    data?.usable_group && typeof data.usable_group === 'object'
      ? data.usable_group
      : {}
  const supportedEndpoint =
    data?.supported_endpoint && typeof data.supported_endpoint === 'object'
      ? data.supported_endpoint
      : {}
  const autoGroups = Array.isArray(data?.auto_groups) ? data.auto_groups : []

  return {
    models,
    vendors,
    groupRatio,
    usableGroup,
    supportedEndpoint,
    autoGroups,
  }
}

export function usePricingData() {
  const { status } = useStatus()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    staleTime: 5 * 60 * 1000,
  })

  // Ensure rates never reach zero to prevent division errors
  const priceRate = useMemo(
    () => Math.max((status?.price as number) ?? 1, 0.001),
    [status?.price]
  )
  const usdExchangeRate = useMemo(
    () => Math.max((status?.usd_exchange_rate as number) ?? priceRate, 0.001),
    [status?.usd_exchange_rate, priceRate]
  )
  const rateLimitConfig = useMemo<PricingRateLimitConfig>(
    () => ({
      enabled: parseBooleanStatusValue(
        readStatusValue(status, 'ModelRequestRateLimitEnabled')
      ),
      durationMinutes: parseNumberStatusValue(
        readStatusValue(status, 'ModelRequestRateLimitDurationMinutes'),
        1
      ),
      groupLimits: parseGroupRateLimits(
        readStatusValue(status, 'ModelRequestRateLimitGroup')
      ),
    }),
    [status]
  )

  const normalized = useMemo(() => normalizePricingData(data), [data])

  const models = useMemo<PricingModel[]>(() => {
    if (normalized.models.length === 0) return []

    const vendorMap = new Map(normalized.vendors.map((v) => [v.id, v]))

    return normalized.models.map((model) => {
      const vendor = model.vendor_id
        ? vendorMap.get(model.vendor_id)
        : undefined
      return {
        ...model,
        key: model.model_name,
        vendor_name: vendor?.name,
        vendor_icon: vendor?.icon,
        vendor_description: vendor?.description,
        enable_groups: Array.isArray(model.enable_groups)
          ? model.enable_groups
          : [],
        supported_endpoint_types: Array.isArray(
          model.supported_endpoint_types
        )
          ? model.supported_endpoint_types
          : [],
        group_ratio: normalized.groupRatio,
      }
    })
  }, [normalized])

  return {
    models,
    vendors: normalized.vendors,
    groupRatio: normalized.groupRatio,
    usableGroup: normalized.usableGroup,
    endpointMap: normalized.supportedEndpoint,
    autoGroups: normalized.autoGroups,
    isLoading,
    error,
    refetch,
    priceRate,
    usdExchangeRate,
    rateLimitConfig,
  }
}
