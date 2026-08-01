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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  getApiKeyFormDefaultValues,
  transformApiKeyToFormDefaults,
} from '../api-key-form'
import type { ApiKey } from '../../types'

const existingApiKey: ApiKey = {
  id: 1,
  name: 'Existing key',
  key: 'sk-existing',
  status: 1,
  remain_quota: 100,
  used_quota: 0,
  unlimited_quota: false,
  expired_time: -1,
  created_time: 0,
  accessed_time: 0,
  group: 'default',
  cross_group_retry: false,
  fallback_model_enabled: false,
  fallback_models: '["model-a"]',
  model_limits_enabled: false,
  model_limits: '',
  allow_ips: '',
}

describe('API key form defaults', () => {
  test('enables system fallback for newly created keys', () => {
    const values = getApiKeyFormDefaultValues(false)

    assert.equal(values.fallback_model_enabled, true)
    assert.deepEqual(values.fallback_models, [])
  })

  test('preserves the fallback setting of an existing key when editing', () => {
    const values = transformApiKeyToFormDefaults(existingApiKey)

    assert.equal(values.fallback_model_enabled, false)
    assert.deepEqual(values.fallback_models, ['model-a'])
  })
})
