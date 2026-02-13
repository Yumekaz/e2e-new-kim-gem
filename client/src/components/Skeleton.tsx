import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps): JSX.Element {
  return (
    <div 
      className={`
        animate-pulse bg-slate-800/50 rounded-lg
        ${className}
      `}
    />
  );
}

export function SkeletonText({ lines = 1, className = '' }: { lines?: number; className?: string }): JSX.Element {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`} 
        />
      ))}
    </div>
  );
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

export function SkeletonMessage(): JSX.Element {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-800/50" />
      <div className="flex-1 space-y-2 max-w-[70%]">
        <div className="h-3 w-20 bg-slate-800/50 rounded" />
        <div className="h-16 bg-slate-800/50 rounded-2xl rounded-tl-sm" />
      </div>
    </div>
  );
}

export function SkeletonRoomList(): JSX.Element {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/30">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
