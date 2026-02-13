import React, { InputHTMLAttributes, forwardRef, useState } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            {label}
          </label>
        )}
        
        <div 
          className={`
            relative flex items-center rounded-xl border-2 transition-all duration-200
            ${error 
              ? 'border-red-500/50 bg-red-500/5' 
              : isFocused 
                ? 'border-indigo-500/50 bg-slate-800/50' 
                : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/50'
            }
          `}
        >
          {leftIcon && (
            <div className="pl-3 text-slate-400">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            className={`
              w-full bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-500
              focus:outline-none disabled:cursor-not-allowed disabled:opacity-50
              ${leftIcon ? 'pl-2' : ''}
              ${rightIcon ? 'pr-2' : ''}
              ${className}
            `}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
          
          {rightIcon && (
            <div className="pr-3 text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        
        {(error || helperText) && (
          <p className={`mt-1.5 text-xs ${error ? 'text-red-400' : 'text-slate-500'}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface CodeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  length?: number;
  onChange?: (value: string) => void;
  error?: string;
}

export const CodeInput = forwardRef<HTMLInputElement, CodeInputProps>(
  ({ length = 6, onChange, error, className = '', ...props }, ref) => {
    const [value, setValue] = useState('');
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length);
      setValue(newValue);
      onChange?.(newValue);
    };
    
    return (
      <div className="w-full">
        <div className="flex gap-2 justify-center">
          {Array.from({ length }).map((_, i) => (
            <div
              key={i}
              className={`
                w-12 h-14 rounded-xl border-2 flex items-center justify-center
                text-xl font-bold font-mono transition-all duration-200
                ${error 
                  ? 'border-red-500/50 bg-red-500/5 text-red-400' 
                  : value[i] 
                    ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400' 
                    : 'border-slate-700/50 bg-slate-800/30 text-slate-400'
                }
              `}
            >
              {value[i] || ''}
            </div>
          ))}
        </div>
        
        <input
          ref={ref}
          type="text"
          className="absolute opacity-0 w-full h-full cursor-text"
          value={value}
          onChange={handleChange}
          {...props}
        />
        
        {error && (
          <p className="mt-2 text-center text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

CodeInput.displayName = 'CodeInput';
