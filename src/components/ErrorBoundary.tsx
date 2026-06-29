import { Component, type ErrorInfo, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  logged: boolean
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, logged: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('error_logs').insert({
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
        route: window.location.pathname + window.location.search,
        error_message: error.message?.slice(0, 2000) || 'Unknown error',
        error_stack: ((error.stack || '') + '\n\nComponent stack:' + (errorInfo.componentStack || '')).slice(0, 8000),
        user_agent: navigator.userAgent.slice(0, 500),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      })
      this.setState({ logged: true })
    } catch (logErr) {
      console.error('Failed to log error:', logErr)
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleCopy = async () => {
    if (!this.state.error) return
    const text = `${this.state.error.message}\n\n${this.state.error.stack || ''}\n\nRoute: ${window.location.pathname}\nUser-Agent: ${navigator.userAgent}`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // fallback: select text in details
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center">
                <svg
                  className="h-8 w-8 text-orange-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
              <p className="mt-2 text-gray-600">
                An unexpected error occurred. {this.state.logged ? "We've logged it and will look into it." : 'Please try reloading the page.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#F97316] text-white font-medium hover:bg-orange-600 transition-colors"
              >
                Reload Page
              </button>
              <a
                href="/dashboard"
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors inline-block"
              >
                Go to Dashboard
              </a>
            </div>

            {this.state.error && (
              <details open className="mt-4 text-left bg-gray-100 rounded-lg p-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 select-none flex items-center justify-between">
                  <span>Error details</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); this.handleCopy() }}
                    className="ml-2 px-2 py-1 text-xs rounded bg-white border border-gray-300 hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </summary>
                <pre className="mt-2 text-xs text-red-700 whitespace-pre-wrap break-words overflow-auto max-h-48">
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}

            <p className="text-xs text-gray-400">RTI Agency</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
