import type { ButtonHTMLAttributes } from 'react';

export function Button({ children, style, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        minHeight: 44,
        padding: '0 20px',
        border: 0,
        borderRadius: 12,
        color: 'white',
        background: '#3d8dff',
        fontWeight: 700,
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
