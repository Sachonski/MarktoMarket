import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 py-4 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <p>© {new Date().getFullYear()} TradeAnalytics. All rights reserved.</p>
      </div>
    </footer>
  );
};