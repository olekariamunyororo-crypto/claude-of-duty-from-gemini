import * as React from 'react';

/**
 * React 19 removed the global JSX namespace; restore it so components can
 * annotate returns as JSX.Element and R3F intrinsic elements resolve.
 */
declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    type ElementClass = React.JSX.ElementClass;
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
  }
}

export {};
