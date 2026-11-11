import React from 'react';

export interface BrandLogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'dark' | 'light' | 'auto';
  className?: string;
}

export const BrandIcon: React.FC<{ sizeClass?: string; className?: string }> = ({ 
  sizeClass = "w-9 h-9", 
  className = "" 
}) => {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${sizeClass} ${className}`}>
      <svg 
        viewBox="0 0 512 512" 
        className="w-full h-full transition-transform duration-200 group-hover:scale-105"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Minimalist Squircle Base */}
        <rect width="512" height="512" rx="140" fill="#090e1a"/>
        
        {/* Document Sheet */}
        <path 
          d="M 172 116 H 292 L 360 184 V 384 C 360 397 349 408 336 408 H 172 C 159 408 148 397 148 384 V 140 C 148 127 159 116 172 116 Z" 
          stroke="#10b981" 
          strokeWidth="28" 
          strokeLinejoin="round"
        />
        
        {/* Precision Corner Fold */}
        <path 
          d="M 292 116 V 184 H 360" 
          stroke="#10b981" 
          strokeWidth="28" 
          strokeLinejoin="round"
        />
        
        {/* 2 Subtle Data Lines */}
        <line x1="204" y1="272" x2="304" y2="272" stroke="#10b981" strokeWidth="24" strokeLinecap="round"/>
        <line x1="204" y1="332" x2="264" y2="332" stroke="#34d399" strokeWidth="24" strokeLinecap="round"/>
      </svg>
    </div>
  );
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  theme = 'auto',
  className = ''
}) => {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', text: 'text-base' },
    md: { icon: 'w-9 h-9', text: 'text-lg' },
    lg: { icon: 'w-12 h-12', text: 'text-2xl' },
    xl: { icon: 'w-16 h-16', text: 'text-3xl' },
  };

  const currentSize = sizeMap[size];

  if (variant === 'icon') {
    return <BrandIcon sizeClass={currentSize.icon} className={className} />;
  }

  const isDark = theme === 'dark';
  const textColor = isDark ? 'text-white' : 'text-gray-900';

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <BrandIcon sizeClass={currentSize.icon} />
      <span className={`font-bold tracking-tight ${currentSize.text} ${textColor}`}>
        Smart<span className="text-brand-500">Doc</span>
      </span>
    </div>
  );
};
