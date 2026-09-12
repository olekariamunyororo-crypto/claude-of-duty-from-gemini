import type { ReactNode } from 'react';

export function Button({ children, onClick, accent }: { children: ReactNode; onClick?: () => void; accent?: boolean }): JSX.Element {
  return (
    <button onClick={onClick} className={`btn-mil ${accent ? '!border-amber-brand !text-amber-brand' : ''}`}>
      {children}
    </button>
  );
}
