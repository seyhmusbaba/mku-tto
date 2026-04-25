'use client';
import React from 'react';

interface State { hasError: boolean; error?: Error; }
interface Props { fallback?: React.ReactNode; children: React.ReactNode; label?: string; }

/**
 * React Error Boundary - alt bileşenlerden biri patlayınca tüm sayfa
 * çökmesin. Kullanıcıya yerel bir hata mesajı + yeniden dene butonu
 * gösterir.
 *
 * Kullanım:
 *   <ErrorBoundary label="Bibliyometri paneli">
 *     <BibliometricsPanel ... />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Prod'da sadece konsola - isterseniz Sentry vs buraya eklenir
    if (typeof console !== 'undefined') {
      console.error(`[ErrorBoundary${this.props.label ? ' ' + this.props.label : ''}]`, error, info);
    }
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="card p-6 text-center" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: '#fee2e2', color: '#dc2626' }}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-red-900">
            {this.props.label ? `"${this.props.label}" bileşeninde hata` : 'Bileşen yüklenirken hata oluştu'}
          </p>
          <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">
            {this.state.error?.message || 'Beklenmeyen bir hata'}
          </p>
          <button onClick={this.reset}
            className="text-xs font-semibold mt-3 px-3 py-1.5 rounded-lg"
            style={{ background: '#dc2626', color: 'white' }}>
            Yeniden Dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
