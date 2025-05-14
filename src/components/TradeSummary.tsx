import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';
import { useBacktest } from '../context/BacktestContext';

export const TradeSummary: React.FC = () => {
  const { backtestData, setBacktestData } = useBacktest();

  if (!backtestData) {
    return null;
  }

  const { symbol, metrics } = backtestData;

  const handleNewUpload = () => {
    setBacktestData(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{symbol}</h3>
          <p className="text-slate-500 text-sm">Backtest Analysis</p>
        </div>
        
        <div className="flex gap-3 mt-4 md:mt-0">
          <button 
            onClick={handleNewUpload}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
          >
            New Upload
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          title="Total Profit/Loss" 
          value={metrics?.totalProfitLoss || "$0"} 
          trend={metrics?.totalProfitLoss?.startsWith('-') ? 'down' : 'up'}
          icon={<DollarSign className="h-5 w-5" />}
        />
        
        <SummaryCard 
          title="Win Rate" 
          value={metrics?.winRate || "0%"} 
          trend={parseFloat(metrics?.winRate || "0") > 50 ? 'up' : 'down'}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        
        <SummaryCard 
          title="Total Trades" 
          value={metrics?.totalTrades?.toString() || "0"} 
          trend="neutral"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        
        <SummaryCard 
          title="Max Drawdown" 
          value={metrics?.maxDrawdown || "0%"} 
          trend="down"
          icon={<TrendingDown className="h-5 w-5" />}
        />
      </div>
    </div>
  );
};

interface SummaryCardProps {
  title: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, trend, icon }) => {
  let trendColor = 'text-slate-500';
  let bgColor = 'bg-slate-100';
  
  if (trend === 'up') {
    trendColor = 'text-emerald-500';
    bgColor = 'bg-emerald-100';
  } else if (trend === 'down') {
    trendColor = 'text-rose-500';
    bgColor = 'bg-rose-100';
  }

  return (
    <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
      <div className="flex justify-between items-start mb-3">
        <span className="text-sm text-slate-500">{title}</span>
        <div className={`p-2 rounded-full ${bgColor}`}>
          <div className={trendColor}>{icon}</div>
        </div>
      </div>
      <div className="text-xl font-bold text-slate-800">{value}</div>
    </div>
  );
};