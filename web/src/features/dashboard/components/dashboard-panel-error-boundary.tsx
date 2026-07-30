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
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import i18next from 'i18next'

interface DashboardPanelErrorBoundaryProps {
  children: ReactNode
  resetKey?: string | number
}

interface DashboardPanelErrorBoundaryState {
  hasError: boolean
}

export class DashboardPanelErrorBoundary extends Component<
  DashboardPanelErrorBoundaryProps,
  DashboardPanelErrorBoundaryState
> {
  state: DashboardPanelErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): DashboardPanelErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[dashboard] panel render failed', error, errorInfo)
    }
  }

  componentDidUpdate(prevProps: DashboardPanelErrorBoundaryProps) {
    if (
      this.state.hasError &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className='text-muted-foreground flex min-h-24 items-center justify-center gap-2 rounded-lg border px-4 py-6 text-sm'>
        <AlertTriangle className='size-4 shrink-0' aria-hidden='true' />
        <span>{i18next.t('This panel failed to load.')}</span>
      </div>
    )
  }
}
