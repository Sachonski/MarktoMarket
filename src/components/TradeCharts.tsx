import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import { useBacktest } from '../context/BacktestContext';
import { Eye, EyeOff } from 'lucide-react';

export const TradeCharts: React.FC = () => {
  const { backtestData } = useBacktest();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [showBacktest, setShowBacktest] = useState(true);
  const [showMarkToMarket, setShowMarkToMarket] = useState(true);
  const [selectedRange, setSelectedRange] = useState('1D');

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

  const handleRangeChange = (range: string) => {
    setSelectedRange(range);
    if (!chartRef.current || !backtestData?.marketData) return;

    const marketData = backtestData.marketData;
    const lastPoint = marketData[marketData.length - 1];
    const endTime = lastPoint ? lastPoint.timestamp : Date.now();
    const endDate = new Date(endTime);
    let startDate = new Date(endTime);

    // Calculate intervals based on 15-minute data points
    const intervalsPerDay = 96; // 24 hours * 4 (15-min intervals)
    switch (range) {
      case '1D':
        // Show last 96 15-minute intervals
        startDate = new Date(endTime - (intervalsPerDay * 15 * 60 * 1000));
        break;
      case '7D':
        // Show last 7 days worth of 15-minute intervals
        startDate = new Date(endTime - (7 * intervalsPerDay * 15 * 60 * 1000));
        break;
      case '30D':
        // Show last 30 days worth of 15-minute intervals
        startDate = new Date(endTime - (30 * intervalsPerDay * 15 * 60 * 1000));
        break;
      case '1Y':
        // Show last year worth of 15-minute intervals
        startDate = new Date(endTime - (365 * intervalsPerDay * 15 * 60 * 1000));
        break;
    }

    chartRef.current.timeScale().setVisibleRange({
      from: Math.floor(startDate.getTime() / 1000),
      to: Math.floor(endDate.getTime() / 1000),
    });
  };

  useEffect(() => {
    if (!backtestData || !chartContainerRef.current) return;

    // Include both T/P and S/L trades in the chart
    const closedTrades = backtestData.trades
      .filter(trade => trade.type.toLowerCase() === 't/p' || trade.type.toLowerCase() === 's/l')
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    if (closedTrades.length === 0) return;

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
        scaleMargins: {
          top: 0.1,
          bottom: 0.3,
        },
      },
      leftPriceScale: {
        borderColor: '#e2e8f0',
        visible: true,
        scaleMargins: {
          top: 0.6,
          bottom: 0.05,
        },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 12,
        barSpacing: 6, // Adjusted for 15-minute intervals
        minBarSpacing: 2,
        rightBarStaysOnScroll: true,
        lockVisibleTimeRangeOnResize: true,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
          });
        },
      },
      crosshair: {
        vertLine: {
          labelBackgroundColor: '#1e293b',
          style: LineStyle.Dashed,
        },
        horzLine: {
          labelBackgroundColor: '#1e293b',
          style: LineStyle.Dashed,
        },
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    let priceData = closedTrades.map(trade => ({
      time: Math.floor(new Date(trade.time).getTime() / 1000),
      value: parseFloat(trade.price),
      profitLoss: parseFloat(trade.profitLoss),
      trades: 1,
      tradeType: trade.type.toUpperCase()
    }));

    const marketData = (backtestData.marketData || [])
      .sort((a, b) => a.timestamp - b.timestamp);

    let markToMarketData = marketData.map(data => ({
      time: Math.floor(data.timestamp / 1000),
      value: data.close,
      convertFX: data.conversionFx || 130.6
    }));

    priceData = priceData.sort((a, b) => a.time - b.time);
    markToMarketData = markToMarketData.sort((a, b) => a.time - b.time);

    priceData = priceData.filter((item, index, self) =>
      index === self.findIndex(t => t.time === item.time)
    );
    markToMarketData = markToMarketData.filter((item, index, self) =>
      index === self.findIndex(t => t.time === item.time)
    );

    const backtestSeries = chart.addLineSeries({
      color: '#2563eb',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
      title: 'Backtest',
      visible: showBacktest,
    });

    const markToMarketSeries = chart.addLineSeries({
      color: '#ef4444',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: false,
      title: 'Mark to Market',
      visible: showMarkToMarket,
    });

    // Create markers with different colors for T/P and S/L trades
    const markers = priceData.map(point => {
      // For T/P trades with profit, use green. For T/P trades with loss, use red.
      // For S/L trades, use amber/orange regardless of profit/loss (typically a loss).
      let markerColor = '#ef444480'; // Default to red (loss)
      
      if (point.tradeType === 'T/P' && point.profitLoss > 0) {
        markerColor = '#10b98180'; // Green for profitable T/P
      } else if (point.tradeType === 'S/L') {
        markerColor = '#f59e0b80'; // Amber for S/L trades
      }
      
      return {
        time: point.time,
        position: 'aboveBar',
        color: markerColor,
        shape: 'circle',
        size: 1,
      };
    });

    backtestSeries.setData(priceData);
    markToMarketSeries.setData(markToMarketData);
    backtestSeries.setMarkers(markers);

    const toolTipDiv = document.createElement('div');
    toolTipDiv.className = 'fixed hidden px-3 py-2 bg-slate-800 text-white text-xs rounded shadow-lg pointer-events-none z-50';
    document.body.appendChild(toolTipDiv);

    let mouseX = 0;
    let mouseY = 0;
    chartContainerRef.current.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    chart.subscribeCrosshairMove(param => {
      if (param.point === undefined || !param.time || param.point.x < 0 || param.point.y < 0) {
        toolTipDiv.style.display = 'none';
        return;
      }

      const tradePoint = priceData.find(d => d.time === param.time);
      const marketPoint = marketData.find(d => Math.floor(d.timestamp / 1000) === param.time);
      const markToMarketPoint = markToMarketData.find(d => d.time === param.time);
      
      if (tradePoint || marketPoint) {
        toolTipDiv.style.display = 'block';
        toolTipDiv.style.left = `${mouseX + 10}px`;
        toolTipDiv.style.top = `${mouseY - 10}px`;
        
        const date = new Date(param.time * 1000);
        const formattedDate = date.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        if (tradePoint) {
          // Show ONLY the trade data at this exact timestamp
          const trade = backtestData.trades.find(t => 
            Math.floor(new Date(t.time).getTime() / 1000) === param.time && 
            (t.type.toLowerCase() === 't/p' || t.type.toLowerCase() === 's/l')
          );
          
          if (trade) {
            toolTipDiv.innerHTML = `
              <div class="space-y-1.5">
                <div class="font-bold text-slate-300">${formattedDate}</div>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div class="text-slate-400">Trade Type:</div>
                  <div class="text-right">${trade.type}</div>
                  <div class="text-slate-400">Price:</div>
                  <div class="text-right">${formatPrice(parseFloat(trade.price))}</div>
                  <div class="text-slate-400">Lots:</div>
                  <div class="text-right">${trade.open}</div>
                  <div class="text-slate-400">P&L:</div>
                  <div class="text-right ${parseFloat(trade.profitLoss) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${formatCurrency(parseFloat(trade.profitLoss))}</div>
                </div>
              </div>
            `;
          }
        } else if (marketPoint) {
          // Show ONLY the market data at this exact timestamp
          toolTipDiv.innerHTML = `
            <div class="space-y-1.5">
              <div class="font-bold text-slate-300">${formattedDate}</div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                <div class="text-slate-400">Open:</div>
                <div class="text-right">${formatPrice(marketPoint.open)}</div>
                <div class="text-slate-400">High:</div>
                <div class="text-right">${formatPrice(marketPoint.high)}</div>
                <div class="text-slate-400">Low:</div>
                <div class="text-right">${formatPrice(marketPoint.low)}</div>
                <div class="text-slate-400">Close:</div>
                <div class="text-right">${formatPrice(marketPoint.close)}</div>
                <div class="text-slate-400">ConvertFX:</div>
                <div class="text-right">${formatPrice(marketPoint.conversionFx || 130.6)}</div>
              </div>
            </div>
          `;
        }
      } else {
        toolTipDiv.style.display = 'none';
      }
    });

    // Set initial range
    handleRangeChange(selectedRange);

    return () => {
      chart.remove();
      document.body.removeChild(toolTipDiv);
    };
  }, [backtestData, showBacktest, showMarkToMarket]);

  if (!backtestData) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Market Analysis</h3>
            </div>
          </div>
          <div className="h-[calc(70vh-24rem)] bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center">
            <p className="text-slate-500">No backtest data available</p>
          </div>
        </div>
      </div>
    );
  }

  const timeRanges = [
    { value: '1D', label: '1 Day' },
    { value: '7D', label: '7 Days' },
    { value: '30D', label: '30 Days' },
    { value: '1Y', label: '1 Year' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Market Analysis</h3>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBacktest(!showBacktest)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  showBacktest 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {showBacktest ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Backtest
              </button>
              <button
                onClick={() => setShowMarkToMarket(!showMarkToMarket)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  showMarkToMarket 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {showMarkToMarket ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Mark to Market
              </button>
            </div>
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
          className="h-[calc(70vh-24rem)] bg-slate-50 rounded-lg border border-slate-100"
        />
      </div>
    </div>
  );
};