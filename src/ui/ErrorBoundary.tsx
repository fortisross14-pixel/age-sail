import { Component, type ReactNode } from 'react';
import { useStore } from '../store';

/**
 * Catches a crash while drawing the screen. The game itself lives in the worker and the last
 * season is saved, so the way out is back to the menu and "Continue voyage".
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Age of Sail: the screen crashed', error);
  }

  private back = () => {
    this.setState({ error: null });
    useStore.getState().quitToMenu();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="menu">
        <div className="menu-card" role="alert">
          <h1>Becalmed</h1>
          <p className="tagline">Something went wrong drawing the game. Your last season is saved.</p>
          <div className="menu-actions">
            <button className="primary" autoFocus onClick={this.back}>Back to the menu</button>
            <button onClick={() => location.reload()}>Reload the page</button>
          </div>
          <p className="muted small">{this.state.error.message}</p>
        </div>
      </div>
    );
  }
}
