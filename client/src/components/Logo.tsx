import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  animated?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 32, text: 'text-xl' },
  md: { icon: 48, text: 'text-2xl' },
  lg: { icon: 64, text: 'text-3xl' },
  xl: { icon: 96, text: 'text-4xl' },
};

export function Logo({ size = 'md', showText = true, animated = true, className = '' }: LogoProps): JSX.Element {
  const { icon, text } = sizes[size];
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`relative ${animated ? 'group' : ''}`}>
        {/* Glow Effect */}
        {animated && (
          <div className="absolute inset-0 bg-indigo-500 rounded-xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
        )}
        
        {/* Icon Container */}
        <div 
          className={`relative bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg ${animated ? 'group-hover:scale-105 transition-transform duration-300' : ''}`}
          style={{ width: icon, height: icon }}
        >
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            className="text-white"
            style={{ width: icon * 0.6, height: icon * 0.6 }}
            stroke="currentColor" 
            strokeWidth="2"
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      </div>
      
      {showText && (
        <span className={`font-bold text-white ${text} tracking-tight`}>
          SecureChat
        </span>
      )}
    </div>
  );
}

export function LogoMark({ size = 48, className = '' }: { size?: number; className?: string }): JSX.Element {
  return (
    <div 
      className={`bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg ${className}`}
      style={{ width: size, height: size }}
    >
      <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        className="text-white"
        style={{ width: size * 0.6, height: size * 0.6 }}
        stroke="currentColor" 
        strokeWidth="2"
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>
  );
}
