import React, { createContext, useContext, useState, ReactNode } from 'react';
import { BacktestData } from '../types/backtest';

interface BacktestContextProps {
  backtestData: BacktestData | null;
  setBacktestData: (data: BacktestData | null) => void;
}

const BacktestContext = createContext<BacktestContextProps | undefined>(undefined);

export const BacktestProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);

  return (
    <BacktestContext.Provider value={{ backtestData, setBacktestData }}>
      {children}
    </BacktestContext.Provider>
  );
};

export const useBacktest = (): BacktestContextProps => {
  const context = useContext(BacktestContext);
  
  if (!context) {
    throw new Error('useBacktest must be used within a BacktestProvider');
  }
  
  return context;
};