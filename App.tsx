import React from 'react';
import { GameCanvas } from './components/GameCanvas';

export default function App() {
  return (
    <div style={{
      width: '100%',
      height: '100vh',
      backgroundColor: '#171717',
      color: 'white',
      overflow: 'hidden'
    }}>
      <GameCanvas />
    </div>
  );
}