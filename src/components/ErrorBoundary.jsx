import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          margin: '20px auto',
          maxWidth: '650px',
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          borderRadius: '14px',
          color: '#9f1239',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <AlertTriangle size={24} color="#e11d48" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>Something went wrong in this view</h3>
          </div>
          <p style={{ fontSize: '0.86rem', color: '#881337', marginBottom: '16px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={this.handleReset}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 16px' }}
            >
              <RefreshCw size={15} />
              <span>Retry / Reload</span>
            </button>
            <button
              type="button"
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = window.location.pathname; }}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
