import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error('[CoD] crash:', error);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-ink p-8 text-center">
          <div className="font-display text-4xl uppercase tracking-[0.2em] text-foe">Mission Failed</div>
          <pre className="max-w-xl overflow-auto font-hud text-xs text-white/60">{String(this.state.error)}</pre>
          <button className="btn-mil w-64 text-center" onClick={() => window.location.reload()}>
            Respawn (reload)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
