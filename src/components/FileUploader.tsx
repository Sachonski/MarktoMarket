import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';
import { useBacktest } from '../context/BacktestContext';
import { parseBacktestHtml } from '../services/parseBacktest';
import type { BacktestData } from '../types/backtest';

interface FileUploaderProps {
  platform: 'MT4' | 'MT5';
}

export const FileUploader: React.FC<FileUploaderProps> = ({ platform }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { setBacktestData } = useBacktest();

  const handleFile = async (file: File) => {
    if (!file) return;
    
    if (file.type !== 'text/html') {
      setError('Please upload an HTML file');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await parseBacktestHtml(file, platform);
      
      // Validate the result before setting it
      if (!result || !result.trades || result.trades.length === 0) {
        throw new Error('Invalid backtest data: No trades found');
      }
      
      setBacktestData(result);
    } catch (err) {
      console.error('Error parsing backtest file:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse the backtest file. Please check the format.');
      // Set empty backtest data to prevent undefined errors
      setBacktestData({
        symbol: 'Unknown',
        trades: [],
        metrics: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: '0%',
          totalProfitLoss: '$0.00',
          avgProfit: '$0.00',
          avgLoss: '0.00',
          maxDrawdown: '0%',
          profitFactor: '0.00',
          sharpRatio: '0.00'
        },
        platform,
        marketData: null,
        initialDeposit: 100000
      } as BacktestData);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="py-8">
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".html"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {isLoading ? (
          <Loader2 className="h-12 w-12 mx-auto text-blue-500 mb-4 animate-spin" />
        ) : (
          <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
        )}
        
        <h3 className="text-xl font-semibold mb-2">Upload {platform} Backtest HTML File</h3>
        <p className="text-slate-500 mb-6">
          {isLoading ? 'Processing your file...' : 'Drag and drop your backtest file here, or click to browse'}
        </p>
        
        <button
          onClick={handleUploadClick}
          disabled={isLoading}
          className={`px-6 py-2 rounded-md text-white font-medium ${
            isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          } transition-colors`}
        >
          {isLoading ? 'Processing...' : 'Select File'}
        </button>
        
        {error && (
          <div className="mt-4 flex items-center text-red-500 gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};