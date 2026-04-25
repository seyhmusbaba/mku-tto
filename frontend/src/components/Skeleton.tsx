'use client';
import React from 'react';

/**
 * Skeleton yer tutucu - veri yüklenirken spinner yerine sayfanın düzen
 * iskeletini göstererek algılanan hızı artırır.
 */

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`skeleton-pulse block rounded-md ${className}`} style={style} aria-hidden="true" />
  );
}

export function SkeletonLine({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return <Skeleton style={{ width, height }} />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-4 space-y-2" aria-busy="true">
      <SkeletonLine height={18} width="60%" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} width={`${70 + Math.random() * 30}%`} />
      ))}
    </div>
  );
}

export function SkeletonKpi() {
  return (
    <div className="card p-5" aria-busy="true">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton style={{ width: 40, height: 40, borderRadius: 12 }} />
      </div>
      <SkeletonLine height={28} width="40%" />
      <SkeletonLine height={12} width="60%" />
    </div>
  );
}

export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr aria-busy="true">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-5 py-3"><SkeletonLine width={`${60 + Math.random() * 40}%`} /></td>
      ))}
    </tr>
  );
}
