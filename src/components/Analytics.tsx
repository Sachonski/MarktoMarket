import React, { useMemo, useState } from 'react';
import { useBacktest } from '../context/BacktestContext';
import { Calendar } from 'lucide-react';

interface PeriodData {
  time: string;
  position: number;
  closed: number;
  aep: number;
  eoPeriodPrice: number;
  convertFX: number;
  open: number;
  total: number;
}

export const Analytics: React.FC = () => {
  const { backtestData } = useBacktest();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value);
  };

  const periodData = useMemo(() => {
    if (!backtestData || !backtestData.marketData || !Array.isArray(backtestData.marketData)) {
      return [];
    }

    const openOrderMap: Record<string, [number, number]> = {}; // [lots, price]
    let position = 0;
    let closedProfit = 0;

    const calculateAverageEntryPrice = (orders: typeof openOrderMap): number => {
      let sumLots = 0;
      let sumPL = 0;
      
      Object.values(orders).forEach(([lots, price]) => {
        sumLots += lots;
        sumPL += lots * price;
      });

      return Math.abs(sumLots) > 0.001 ? sumPL / sumLots : 0;
    };

    // Sort trades by time
    const sortedTrades = [...backtestData.trades].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    // Process market data with trade information
    return backtestData.marketData.map(data => {
      const timestamp = new Date(data.timestamp);
      
      // Process all trades that happened before or at this timestamp
      while (sortedTrades.length > 0 && new Date(sortedTrades[0].time) <= timestamp) {
        const trade = sortedTrades.shift()!;
        const lots = parseFloat(trade.open);
        const price = parseFloat(trade.price);
        const profitLoss = parseFloat(trade.profitLoss);

        switch (trade.type.toLowerCase()) {
          case 'buy':
            position = Number((position + lots).toFixed(2));
            openOrderMap[trade.time] = [lots, price];
            break;
          case 'sell':
            position = Number((position - lots).toFixed(2));
            openOrderMap[trade.time] = [-lots, price];
            break;
          case 't/p':
          case 'close at stop':
            const orderKey = Object.keys(openOrderMap)[0]; // Get the oldest open order
            if (orderKey) {
              const [orderLots] = openOrderMap[orderKey];
              const direction = orderLots > 0 ? 1 : -1;
              position = Number((position - direction * lots).toFixed(2));
              delete openOrderMap[orderKey];
              closedProfit += profitLoss;
            }
            break;
        }
      }

      const aep = calculateAverageEntryPrice(openOrderMap);
      const floating = Math.abs(position) > 0.001 
        ? ((data.close - aep) * position * 100000) / data.conversionFx 
        : 0;

      return {
        time: timestamp.toISOString().split('.')[0].replace('T', ' '),
        position,
        closed: Number(closedProfit.toFixed(2)),
        aep: Number(aep.toFixed(3)),
        eoPeriodPrice: data.close,
        convertFX: data.conversionFx,
        open: Number(floating.toFixed(2)),
        total: Number((floating + closedProfit).toFixed(2))
      };
    });
  }, [backtestData]);

  const filteredData = useMemo(() => {
    if (!fromDate && !toDate) return periodData;
    
    return periodData.filter(period => {
      const periodDate = new Date(period.time);
      const isAfterFrom = !fromDate || periodDate >= new Date(fromDate);
      const isBeforeTo = !toDate || periodDate <= new Date(toDate + 'T23:59:59');
      return isAfterFrom && isBeforeTo;
    });
  }, [periodData, fromDate, toDate]);

  if (!backtestData) {
    return null;
  }

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const indexOfLastPeriod = currentPage * pageSize;
  const indexOfFirstPeriod = indexOfLastPeriod - pageSize;
  const currentPeriods = filteredData.slice(indexOfFirstPeriod, indexOfLastPeriod);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  return (
    <div className="overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Mark to Market Analytics (15min)</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1 border rounded-md text-sm"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1 border rounded-md text-sm"
              />
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          {filteredData.length > 0 
            ? `Showing periods ${indexOfFirstPeriod + 1}-${Math.min(indexOfLastPeriod, filteredData.length)} of ${filteredData.length}`
            : 'No data available'}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-right font-semibold">Pos</th>
              <th className="px-4 py-3 text-right font-semibold">Closed</th>
              <th className="px-4 py-3 text-right font-semibold">AEP</th>
              <th className="px-4 py-3 text-right font-semibold">EOPeriod Price</th>
              <th className="px-4 py-3 text-right font-semibold">ConvertFX</th>
              <th className="px-4 py-3 text-right font-semibold">Open</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentPeriods.length > 0 ? (
              currentPeriods.map((period, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm">{period.time}</td>
                  <td className="px-4 py-3 text-sm text-right">{period.position}</td>
                  <td className="px-4 py-3 text-sm text-right">${formatCurrency(period.closed)}</td>
                  <td className="px-4 py-3 text-sm text-right">${formatPrice(period.aep)}</td>
                  <td className="px-4 py-3 text-sm text-right">${formatPrice(period.eoPeriodPrice)}</td>
                  <td className="px-4 py-3 text-sm text-right">${formatPrice(period.convertFX)}</td>
                  <td className="px-4 py-3 text-sm text-right">${formatCurrency(period.open)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    <span className={period.total >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      ${formatCurrency(period.total)}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No analytics data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t flex justify-between items-center text-sm">
          <div className="flex items-center gap-4">
            <span>
              Showing {indexOfFirstPeriod + 1}-{Math.min(indexOfLastPeriod, filteredData.length)} of {filteredData.length} periods
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