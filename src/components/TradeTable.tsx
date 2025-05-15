import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowDownUp, Download, Eye } from 'lucide-react';
import { useBacktest } from '../context/BacktestContext';
import { Trade } from '../types/backtest';

interface TradeTableProps {
  selectedTradeType: string;
  setSelectedTradeType: (type: string) => void;
}

export const TradeTable: React.FC<TradeTableProps> = ({ selectedTradeType, setSelectedTradeType }) => {
  const { backtestData } = useBacktest();
  const [sortField, setSortField] = useState<keyof Trade>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  if (!backtestData || !backtestData.trades || backtestData.trades.length === 0) {
    return null;
  }

  // Ensure S/L trades are recognized in the system
  const enhancedTrades = backtestData.trades.map(trade => {
    // If the trade doesn't have a defined type, check if it's a stop loss based on other attributes
    if (trade.type === 'S/L' || (trade.type === undefined && trade.stopLoss && parseFloat(trade.profitLoss) < 0)) {
      return { ...trade, type: 'S/L' };
    }
    return trade;
  });

  // Get unique trade types
  const tradeTypes = Array.from(new Set(enhancedTrades.map(trade => trade.type)));
  
  // Create custom filter options
  const customFilters = [
    { value: 'ALL', label: 'All Trades' },
    { value: 'CLOSED', label: 'Closed Trades (S/L + T/P)' }
  ];
  
  let filteredTrades = enhancedTrades;
  
  if (selectedTradeType === 'CLOSED') {
    // Show only S/L and T/P trades
    filteredTrades = enhancedTrades.filter(trade => 
      trade.type === 'S/L' || trade.type === 'T/P'
    );
  } else if (selectedTradeType !== 'ALL') {
    // Filter by specific trade type
    filteredTrades = enhancedTrades.filter(trade => trade.type === selectedTradeType);
  }

  const sortedTrades = [...filteredTrades].sort((a, b) => {
    if (a[sortField] < b[sortField]) return sortDirection === 'asc' ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedTrades.length / pageSize);
  const indexOfLastTrade = currentPage * pageSize;
  const indexOfFirstTrade = indexOfLastTrade - pageSize;
  const currentTrades = sortedTrades.slice(indexOfFirstTrade, indexOfLastTrade);

  const handleSort = (field: keyof Trade) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatPrice = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(num);
  };

  const exportToCSV = () => {
    if (!backtestData || !backtestData.trades) return;

    const headers = Object.keys(enhancedTrades[0]).join(',');
    const rows = enhancedTrades.map(trade => 
      Object.values(trade).join(',')
    ).join('\n');
    
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `backtest_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIcon = ({ field }: { field: keyof Trade }) => {
    if (sortField !== field) return <ArrowDownUp className="w-4 h-4 opacity-40" />;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  // Helper to get appropriate style for trade type
  const getTradeTypeStyle = (type: string) => {
    switch(type) {
      case 'BUY':
        return 'bg-emerald-100 text-emerald-800';
      case 'SELL':
        return 'bg-rose-100 text-rose-800';
      case 'T/P':
        return 'bg-blue-100 text-blue-800';
      case 'S/L':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };
  
  // Helper to format numeric values with fallback
  const formatNumericValue = (value: string | number | undefined, formatter: (val: string | number) => string) => {
    if (value === undefined || value === null || value === '' || isNaN(parseFloat(value.toString()))) {
      return '-';
    }
    return '$' + formatter(value);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 flex justify-between items-center border-b">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Trade History</h3>
          <select
            value={selectedTradeType}
            onChange={(e) => setSelectedTradeType(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors border-none focus:ring-2 focus:ring-blue-200"
          >
            {customFilters.map(filter => (
              <option key={filter.value} value={filter.value}>{filter.label}</option>
            ))}
            {tradeTypes
              .filter(type => !['ALL', 'CLOSED'].includes(type)) // Exclude any that might overlap with custom filters
              .map(type => (
                <option key={type} value={type}>{type}</option>
              ))
            }
          </select>
        </div>
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">
                <button 
                  className="flex items-center gap-1.5"
                  onClick={() => handleSort('time')}
                >
                  Time <SortIcon field="time" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <button 
                  className="flex items-center gap-1.5"
                  onClick={() => handleSort('type')}
                >
                  Type <SortIcon field="type" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <button 
                  className="flex items-center gap-1.5"
                  onClick={() => handleSort('price')}
                >
                  Price <SortIcon field="price" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <button 
                  className="flex items-center gap-1.5"
                  onClick={() => handleSort('takeProfit')}
                >
                  Take Profit <SortIcon field="takeProfit" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <button 
                  className="flex items-center gap-1.5"
                  onClick={() => handleSort('stopLoss')}
                >
                  Stop Loss <SortIcon field="stopLoss" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <button 
                  className="flex items-center gap-1.5"
                  onClick={() => handleSort('balance')}
                >
                  Balance <SortIcon field="balance" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold">
                <button 
                  className="flex items-center gap-1.5"
                  onClick={() => handleSort('profitLoss')}
                >
                  P/L <SortIcon field="profitLoss" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentTrades.map((trade, index) => (
              <tr 
                key={index} 
                className="hover:bg-slate-50 transition-colors"
              >
                <td className="px-4 py-3 text-sm">{trade.time}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTradeTypeStyle(trade.type)}`}>
                    {trade.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{formatNumericValue(trade.price, formatPrice)}</td>
                <td className="px-4 py-3 text-sm">{formatNumericValue(trade.takeProfit, formatPrice)}</td>
                <td className="px-4 py-3 text-sm">{formatNumericValue(trade.stopLoss, formatPrice)}</td>
                <td className="px-4 py-3 text-sm">{formatNumericValue(trade.balance, formatCurrency)}</td>
                <td className={`px-4 py-3 text-sm font-medium ${
                  parseFloat(trade.profitLoss) > 0 ? 'text-emerald-600' : 
                  parseFloat(trade.profitLoss) < 0 ? 'text-rose-600' : 'text-slate-600'
                }`}>
                  {formatNumericValue(trade.profitLoss, formatCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t flex justify-between items-center text-sm">
          <div className="flex items-center gap-4">
            <span>
              Showing {indexOfFirstTrade + 1}-{Math.min(indexOfLastTrade, sortedTrades.length)} of {sortedTrades.length} trades
            </span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-2 py-1 border rounded-md text-sm"
            >
              <option value={10}>10 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded ${
                currentPage === 1 ? 'text-slate-400 cursor-not-allowed' : 'hover:bg-slate-100'
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded ${
                currentPage === totalPages ? 'text-slate-400 cursor-not-allowed' : 'hover:bg-slate-100'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};