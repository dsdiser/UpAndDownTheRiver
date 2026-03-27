declare module 'motion' {
  import * as React from 'react';
  import { AnimationControls } from 'framer-motion';

  export const motion: any;
  export function useAnimation(): AnimationControls;

  export as namespace motion;
}
