import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useBacktest } from '../context/BacktestContext';
import { Calendar, Eye, EyeOff } from 'lucide-react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';

interface PeriodData {
  time: string;
  position: number;
  closed: number;
  aep: number;
  eoPeriodPrice: number;
  convertFX: number;
  open: number;
  total: number;
  timestamp: number;
}

export const Analytics: React.FC = () => {
  const { backtestData } = useBacktest();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Chart states
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [selectedRange, setSelectedRange] = useState('All');

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
          case 's/l':
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
        timestamp: data.timestamp,
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

  const handleRangeChange = (range: string) => {
    setSelectedRange(range);
    if (!chartRef.current || !filteredData.length) return;

    if (range === 'All') {
      // Show from first to last data point
      const firstTime = Math.floor(filteredData[0].timestamp / 1000);
      const lastTime = Math.floor(filteredData[filteredData.length - 1].timestamp / 1000);
      
      chartRef.current.timeScale().setVisibleRange({
        from: firstTime,
        to: lastTime
      });
    } else {
      // Use specific time ranges for other options
      const lastPoint = filteredData[filteredData.length - 1];
      const endTime = lastPoint.timestamp;
      const endDate = new Date(endTime);
      let startDate = new Date(endTime);

      const intervalsPerDay = 96; // 24 hours * 4 (15-min intervals)
      switch (range) {
        case '1D':
          startDate = new Date(endTime - (intervalsPerDay * 15 * 60 * 1000));
          break;
        case '7D':
          startDate = new Date(endTime - (7 * intervalsPerDay * 15 * 60 * 1000));
          break;
        case '30D':
          startDate = new Date(endTime - (30 * intervalsPerDay * 15 * 60 * 1000));
          break;
        case '1Y':
          startDate = new Date(endTime - (365 * intervalsPerDay * 15 * 60 * 1000));
          break;
      }

      chartRef.current.timeScale().setVisibleRange({
        from: Math.floor(startDate.getTime() / 1000),
        to: Math.floor(endDate.getTime() / 1000),
      });
    }
  };

  // Chart effect
  useEffect(() => {
    if (!chartContainerRef.current || !filteredData.length) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#f8fafc' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: '#e2e8f0' },
        horzLines: { color: '#e2e8f0' },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        mode: 1, // Normal scale
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        rightBarStaysOnScroll: false,
        lockVisibleTimeRangeOnResize: true,
        minBarSpacing: 0.1,
        barSpacing: 1,
        fixLeftEdge: false,
        fixRightEdge: false,
        visible: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: false,
        },
        axisDoubleClickReset: {
          time: true,
          price: false,
        },
        mouseWheel: true,
        pinch: true,
      },
      crosshair: {
        vertLine: {
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          labelBackgroundColor: '#1e293b',
        },
      },
    });

    chartRef.current = chart;

    // Prepare data series - single line for totals only
    const totalSeries = filteredData.map(d => ({
      time: Math.floor(d.timestamp / 1000),
      value: d.total + backtestData.initialDeposit // Add initial deposit to the total
    }));

    // Add single line series for totals
    const totalLine = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 3,
      title: 'Total Balance',
    });

    totalLine.setData(totalSeries);

    // Set the visible range to show from first to last data point
    if (totalSeries.length > 0) {
      const firstTime = totalSeries[0].time;
      const lastTime = totalSeries[totalSeries.length - 1].time;
      
      chart.timeScale().setVisibleRange({
        from: firstTime,
        to: lastTime
      });
    }

    // Create tooltip
    const toolTipDiv = document.createElement('div');
    toolTipDiv.className = 'fixed hidden px-3 py-2 bg-slate-800 text-white text-xs rounded shadow-lg pointer-events-none z-50';
    document.body.appendChild(toolTipDiv);

    let mouseX = 0;
    let mouseY = 0;
    const mouseMoveHandler = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    chartContainerRef.current.addEventListener('mousemove', mouseMoveHandler);

    chart.subscribeCrosshairMove(param => {
      if (param.point === undefined || !param.time || param.point.x < 0 || param.point.y < 0) {
        toolTipDiv.style.display = 'none';
        return;
      }

      const dataPoint = filteredData.find(d => Math.floor(d.timestamp / 1000) === param.time);
      
      if (dataPoint) {
        toolTipDiv.style.display = 'block';
        toolTipDiv.style.left = `${mouseX + 10}px`;
        toolTipDiv.style.top = `${mouseY - 10}px`;
        
        const formattedDate = new Date(dataPoint.timestamp).toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        toolTipDiv.innerHTML = `
          <div class="space-y-1">
            <div class="font-bold">${formattedDate}</div>
            <div>Position: ${dataPoint.position}</div>
            <div>Closed P&L: $${formatCurrency(dataPoint.closed)}</div>
            <div>Open P&L: $${formatCurrency(dataPoint.open)}</div>
            <div>Net P&L: <span class="${dataPoint.total >= 0 ? 'text-emerald-400' : 'text-rose-400'}">$${formatCurrency(dataPoint.total)}</span></div>
            <div>Total Balance: <span class="${(dataPoint.total + backtestData.initialDeposit) >= backtestData.initialDeposit ? 'text-emerald-400' : 'text-rose-400'}">$${formatCurrency(dataPoint.total + backtestData.initialDeposit)}</span></div>
          </div>
        `;
      } else {
        toolTipDiv.style.display = 'none';
      }
    });

    // Set initial range - show all data from first to last point
    if (totalSeries.length > 0) {
      const firstTime = totalSeries[0].time;
      const lastTime = totalSeries[totalSeries.length - 1].time;
      
      chartRef.current.timeScale().setVisibleRange({
        from: firstTime,
        to: lastTime
      });
    }

    return () => {
      chart.remove();
      if (document.body.contains(toolTipDiv)) {
        document.body.removeChild(toolTipDiv);
      }
      if (chartContainerRef.current) {
        chartContainerRef.current.removeEventListener('mousemove', mouseMoveHandler);
      }
    };
  }, [filteredData, backtestData?.initialDeposit]);

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

  const timeRanges = [
    { value: 'All', label: 'All' },
    { value: '1D', label: '1 Day' },
    { value: '7D', label: '7 Days' },
    { value: '30D', label: '30 Days' },
    { value: '1Y', label: '1 Year' }
  ];

  return (
    <div className="w-full h-full">
      {/* Chart Section */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-4">
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Period Totals Chart</h3>
            </div>
            <div className="flex gap-2">
              {timeRanges.map(range => (
                <button
                  key={range.value}
                  onClick={() => handleRangeChange(range.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    selectedRange === range.value
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
          <div 
            ref={chartContainerRef} 
            className="h-96 bg-slate-50 rounded-lg border border-slate-100"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
                <option value={300}>300 per page</option>
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
    </div>
  );
};