import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      info: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturou um erro:', error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded text-center">
          <p className="text-rose-600 font-semibold mb-3">Algo deu errado ao carregar a página.</p>
          <p className="text-sm text-gray-600 mb-4">
            Atualize ou reinicie o app para tentar novamente. O erro já foi logado no console.
          </p>
          <button
            type="button"
            className="px-4 py-2 bg-rose-500 text-white rounded shadow hover:bg-rose-600 transition"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
