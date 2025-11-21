import React, { lazy, Suspense } from 'react';
import { LoadingScreen } from './LoadingScreen';

// 使用 React.lazy 進行代碼分割
const GameCanvas = lazy(() => 
  import('./GameCanvas').then(module => ({ default: module.GameCanvas }))
);

export const LazyGameCanvas: React.FC = () => {
  return (
    <Suspense fallback={<LoadingScreen progress={50} status="載入遊戲組件..." />}>
      <GameCanvas />
    </Suspense>
  );
};