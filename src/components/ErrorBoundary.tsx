import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("ErrorBoundary capturó:", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-4 p-6 border rounded-lg bg-card">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Algo salió mal</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ocurrió un error inesperado al cargar esta pantalla.
              </p>
            </div>
            {this.state.error && (
              <div className="text-xs text-left bg-muted p-3 rounded font-mono overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={this.reset}>
                Reintentar
              </Button>
              <Button size="sm" onClick={this.reload}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Recargar página
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
