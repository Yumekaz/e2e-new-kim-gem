import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', hover = false, onClick }: CardProps): JSX.Element {
  return (
    <div 
      className={`
        bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl
        ${hover ? 'hover:border-indigo-500/30 hover:bg-slate-800/50 transition-all duration-300 cursor-pointer' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface FeatureCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  color?: 'indigo' | 'green' | 'purple' | 'orange';
}

const colorClasses = {
  indigo: 'from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30',
  green: 'from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30',
  purple: 'from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30',
  orange: 'from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30',
};

const iconColors = {
  indigo: 'bg-indigo-500/20 text-indigo-400',
  green: 'bg-emerald-500/20 text-emerald-400',
  purple: 'bg-purple-500/20 text-purple-400',
  orange: 'bg-orange-500/20 text-orange-400',
};

export function FeatureCard({ icon, title, description, onClick, color = 'indigo', ...props }: FeatureCardProps): JSX.Element {
  return (
    <div 
      onClick={onClick}
      {...props}
      className={`
        group relative p-6 rounded-2xl bg-gradient-to-br ${colorClasses[color]}
        border border-slate-800/50 hover:border-slate-700/50
        transition-all duration-300 cursor-pointer
        ${onClick ? 'hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/10' : ''}
      `}
    >
      <div className={`
        w-12 h-12 rounded-xl ${iconColors[color]} 
        flex items-center justify-center mb-4
        group-hover:scale-110 transition-transform duration-300
      `}>
        {icon}
      </div>
      
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
      
      {onClick && (
        <div className="mt-4 flex items-center text-sm font-medium text-indigo-400 group-hover:text-indigo-300">
          Get Started
          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
}

export function StatCard({ label, value, icon, trend }: StatCardProps): JSX.Element {
  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400">{label}</span>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {trend && (
          <span className={`text-xs mb-1 ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  );
}
