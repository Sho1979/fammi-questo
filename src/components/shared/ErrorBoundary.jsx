/**
 * ErrorBoundary — Cattura errori React non gestiti e mostra un fallback amichevole.
 * Usato in AppShell per evitare schermate bianche.
 *
 * Props: children, fallback? (optional custom fallback component)
 */
import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Errore non gestito:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback se fornito
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center bg-gray-50">
          <div className="mb-4 rounded-2xl p-4 bg-red-50">
            <AlertTriangle size={40} className="text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Qualcosa è andato storto</h2>
          <p className="text-sm text-gray-500 max-w-[300px] mb-4">
            Si è verificato un errore inaspettato. Prova a ricaricare la pagina.
          </p>
          {this.state.error?.message && (
            <p className="text-xs text-gray-400 mb-4 max-w-[300px] break-words font-mono">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold
              text-white shadow-md hover:bg-violet-700 active:scale-[0.97] transition-all"
          >
            <RefreshCw size={16} />
            Riprova
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
