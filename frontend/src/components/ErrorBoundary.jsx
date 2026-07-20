/**
 * ErrorBoundary — Red de seguridad ante errores de render inesperados.
 *
 * Sin esto, si cualquier componente del Dashboard lanza una excepción durante
 * el render (por ejemplo, un dato inesperado en la respuesta del escaneo),
 * React desmonta todo el árbol y el usuario ve una pantalla en negro sin
 * ninguna explicación. Con el boundary, mostramos un mensaje claro y un botón
 * para reiniciar en vez de dejar la app rota en silencio.
 */

import { Component } from "react";
import { BoomIcon } from "./ui/Icons";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log para debugging; no envía nada a servidores externos.
    console.error("DebtRadar UI crashed:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto px-6 py-32 text-center space-y-6 animate-fade-in" role="alert">
          <div className="flex justify-center">
            <BoomIcon size={56} className="text-semantic-error" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary">
            Something went wrong rendering the results
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            This is usually caused by a very large repository or an unexpected data
            shape. You can try scanning a smaller subfolder.
          </p>
          {this.state.error && (
            <details className="text-left">
              <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary interactive-transition text-center">
                View error details
              </summary>
              <pre className="mt-2 text-xs font-mono text-text-muted bg-surface-0/50 rounded-md px-4 py-3 text-left break-all whitespace-pre-wrap max-h-32 overflow-y-auto">
                {this.state.error?.message || String(this.state.error)}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            className="btn-primary btn-magnetic"
          >
            Back to start
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
