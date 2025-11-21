import React from 'react';
import { GameCanvas } from './components/GameCanvas';

export default function App() {
  return (
    <div className="w-full h-screen bg-neutral-900 text-white overflow-hidden">
      <GameCanvas />
    </div>
  );
}