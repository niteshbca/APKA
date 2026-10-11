import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="page-content">
          <div className="card" style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>⚠️</div>
            <h2 style={{ marginBottom: 8 }}>Something went wrong on this screen</h2>
            <p className="muted small" style={{ marginBottom: 16 }}>
              {this.state.error?.message || 'Unexpected error'}
            </p>
            <div className="flex" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="btn" onClick={this.reset}>Try again</button>
              <button className="btn btn-ghost" onClick={() => { window.location.href = '/'; }}>Go to Dashboard</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
