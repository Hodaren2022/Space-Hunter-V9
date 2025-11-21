import React from 'react';

interface LoadingScreenProps {
  progress?: number;
  status?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  progress = 0, 
  status = '正在載入...' 
}) => {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      {/* 背景網格效果 */}
      <div className="absolute inset-0 opacity-20">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 243, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 243, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* 主要載入內容 */}
      <div className="relative z-10 text-center">
        {/* 遊戲標題 */}
        <h1 className="text-6xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 animate-pulse">
          太空獵手
        </h1>
        <h2 className="text-2xl text-cyan-300 mb-12 font-mono">
          SPACE HUNTER
        </h2>

        {/* 載入動畫 */}
        <div className="mb-8">
          <div className="relative w-64 h-64 mx-auto">
            {/* 外圈旋轉環 */}
            <div className="absolute inset-0 border-4 border-transparent border-t-cyan-400 border-r-pink-500 rounded-full animate-spin"></div>
            
            {/* 內圈反向旋轉環 */}
            <div className="absolute inset-4 border-2 border-transparent border-b-cyan-300 border-l-pink-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }}></div>
            
            {/* 中心脈衝點 */}
            <div className="absolute inset-1/2 w-4 h-4 -ml-2 -mt-2 bg-gradient-to-r from-cyan-400 to-pink-500 rounded-full animate-pulse"></div>
            
            {/* 掃描線效果 */}
            <div className="absolute inset-8 border border-cyan-400 rounded-full opacity-50 animate-ping"></div>
          </div>
        </div>

        {/* 進度條 */}
        <div className="w-80 mx-auto mb-6">
          <div className="flex justify-between text-sm text-cyan-300 mb-2">
            <span>載入進度</span>
            <span>{Math.round(progress)}%</span>
          </div>
          
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-cyan-500">
            <div 
              className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              {/* 進度條光效 */}
              <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* 狀態文字 */}
        <div className="text-cyan-300 font-mono text-lg mb-4">
          {status}
        </div>

        {/* 載入點動畫 */}
        <div className="flex justify-center space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
              style={{ 
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>

        {/* 提示文字 */}
        <div className="mt-8 text-gray-400 text-sm font-mono">
          正在初始化遊戲系統...
        </div>
      </div>

      {/* 邊框光效 */}
      <div className="absolute inset-0 border-2 border-cyan-500 opacity-30 animate-pulse pointer-events-none"></div>
      
      {/* 角落裝飾 */}
      <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-cyan-400"></div>
      <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-pink-500"></div>
      <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-pink-500"></div>
      <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-cyan-400"></div>
    </div>
  );
};