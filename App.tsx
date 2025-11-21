import React, { useState, useEffect } from 'react';
import { LazyGameCanvas } from './components/LazyGameCanvas';
import { LoadingScreen } from './components/LoadingScreen';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('正在初始化...');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadGame = async () => {
      try {
        // 模擬載入過程
        const loadingSteps = [
          { progress: 10, status: '載入遊戲引擎...' },
          { progress: 25, status: '初始化音效系統...' },
          { progress: 40, status: '載入遊戲資源...' },
          { progress: 60, status: '準備遊戲世界...' },
          { progress: 80, status: '載入玩家數據...' },
          { progress: 95, status: '最終檢查...' },
          { progress: 100, status: '載入完成！' }
        ];

        for (const step of loadingSteps) {
          // 縮短載入時間，提升用戶體驗
          await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
          setLoadingProgress(step.progress);
          setLoadingStatus(step.status);
        }

        // 縮短完成狀態顯示時間
        await new Promise(resolve => setTimeout(resolve, 200));
        setIsLoading(false);
      } catch (error) {
        console.error('載入遊戲時發生錯誤:', error);
        setHasError(true);
        setLoadingStatus('載入失敗，這可能是網路問題或瀏覽器相容性問題');
      }
    };

    loadGame();
  }, []);

  // 錯誤處理
  if (hasError) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-red-500 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-4xl font-bold text-red-500 mb-4">載入錯誤</h1>
            <p className="text-xl text-gray-300 mb-2">遊戲載入時發生問題</p>
            <p className="text-sm text-gray-400 mb-6">{loadingStatus}</p>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-lg transition-colors"
            >
              重新載入遊戲
            </button>
            
            <button 
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
                setLoadingProgress(0);
                setLoadingStatus('正在重試...');
                // 重新觸發載入
                window.location.reload();
              }}
              className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
            >
              重試載入
            </button>
          </div>
          
          <div className="mt-6 text-xs text-gray-500">
            <p>如果問題持續發生，請檢查：</p>
            <ul className="mt-2 text-left">
              <li>• 網路連線是否正常</li>
              <li>• 瀏覽器是否支援現代JavaScript</li>
              <li>• 是否啟用了廣告攔截器</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // 載入中
  if (isLoading) {
    return <LoadingScreen progress={loadingProgress} status={loadingStatus} />;
  }

  // 遊戲主畫面
  return (
    <div className="w-full h-screen bg-neutral-900 text-white overflow-hidden">
      <LazyGameCanvas />
    </div>
  );
}