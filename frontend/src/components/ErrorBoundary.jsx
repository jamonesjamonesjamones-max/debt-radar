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
        <div className="max-w-lg mx-auto px-6 py-32 text-center space-y-4">
          <div className="text-5xl">💥</div>
          <h2 className="text-xl font-semibold text-text-primary">
            Something went wrong rendering the results
          </h2>
          <p className="text-text-secondary text-sm font-mono bg-surface-2 border border-surface-3 rounded-md px-4 py-3 text-left break-all">
            {this.state.error?.message || String(this.state.error)}
          </p>
          <p className="text-text-muted text-xs">
            This is usually caused by a very large repository or an unexpected
            data shape. Try scanning a smaller subfolder.
          </p>
          <button
            onClick={this.handleReset}
            className="px-5 py-2.5 rounded-md text-sm font-medium
                       bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            Back to start
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
