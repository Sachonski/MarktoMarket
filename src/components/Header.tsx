import React from 'react';
import { Activity } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-slate-900 text-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center">
        <div className="flex items-center space-x-2">
          <Activity className="h-6 w-6 text-teal-400" />
          <h1 className="text-xl font-bold">TradeAnalytics</h1>
        </div>
      </div>
    </header>
  );
};