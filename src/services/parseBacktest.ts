import { BacktestData, Trade, Metrics, MarketData } from '../types/backtest';

export const parseBacktestHtml = async (file: File, platform: 'MT4' | 'MT5'): Promise<BacktestData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const html = e.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const trades = extractTrades(doc, platform);
        
        if (!trades || trades.length === 0) {
          throw new Error('No valid trades found in the backtest file');
        }
        
        const symbol = extractSymbol(doc, platform);
        const initialDeposit = extractInitialDeposit(doc);
        const metrics = calculateMetrics(trades);

        // Get date range from trades
        const firstTradeDate = new Date(trades[0].time);
        const lastTradeDate = new Date(trades[trades.length - 1].time);

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-data?from_date=${firstTradeDate.toISOString().split('T')[0]}&to_date=${lastTradeDate.toISOString().split('T')[0]}&timeframe=M15&symbols=${symbol}`;

        console.log('Making API call to:', apiUrl);

        try {
          const response = await fetch(apiUrl, {
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            }
          });
          console.log('API Response status:', response.status);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const text = await response.text();
          console.log('Raw response:', text);

          // Split the response by newlines and parse each line
          const marketData = text
            .trim()
            .split('\n')
            .map(line => {
              try {
                const item = JSON.parse(line);
                return {
                  timestamp: new Date(item.time).getTime(),
                  open: parseFloat(item.open),
                  high: parseFloat(item.high),
                  low: parseFloat(item.low),
                  close: parseFloat(item.close),
                  volume: parseFloat(item.volume),
                  conversionFx: item.conversionFx ? parseFloat(item.conversionFx) : 130.932,
                  symbol: item.symbol
                };
              } catch (e) {
                console.error('Failed to parse line:', line, e);
                return null;
              }
            })
            .filter((item): item is MarketData => item !== null);

          console.log('Parsed market data:', marketData.length, 'items');
          
          resolve({
            symbol,
            trades,
            metrics,
            platform,
            marketData,
            initialDeposit
          });
        } catch (error) {
          console.error('API call failed:', error);
          resolve({
            symbol,
            trades,
            metrics,
            platform,
            marketData: null,
            initialDeposit
          });
        }
      } catch (error) {
        console.error('Error parsing HTML:', error);
        reject(new Error('Failed to parse the backtest file. Please check the format.'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read the file'));
    };
    
    reader.readAsText(file);
  });
};

const extractInitialDeposit = (doc: Document): number => {
  const depositRow = Array.from(doc.querySelectorAll('tr')).find(row => {
    const cells = row.querySelectorAll('td');
    return cells.length >= 2 && cells[0]?.textContent?.trim().toLowerCase() === 'initial deposit';
  });

  if (depositRow) {
    const depositCell = depositRow.querySelector('td:last-child');
    const depositText = depositCell?.textContent?.trim() || '0';
    return parseFloat(depositText.replace(/[^0-9.-]+/g, ''));
  }

  return 100000; // Default value if not found
};

const extractSymbol = (doc: Document, platform: 'MT4' | 'MT5'): string => {
  let fullSymbol = '';
  
  if (platform === 'MT4') {
    const symbolRow = Array.from(doc.querySelectorAll('tr')).find(row => {
      const cells = row.querySelectorAll('td');
      return cells.length >= 2 && cells[0]?.textContent?.trim().toLowerCase() === 'symbol';
    });

    if (symbolRow) {
      const symbolCell = symbolRow.querySelector('td:last-child');
      fullSymbol = symbolCell?.textContent?.trim() || 'Unknown';
    }
  } else {
    // First try to find the symbol in the standard MT5 format with class names
    const symbolElement = doc.querySelector('.symbol-name, .instrument-name');
    if (symbolElement) {
      fullSymbol = symbolElement.textContent?.trim() || 'Unknown';
    } else {
      // If not found, try the table row format
      const symbolRow = Array.from(doc.querySelectorAll('tr')).find(row => {
        const cells = row.querySelectorAll('td');
        return cells.length >= 2 && cells[0]?.textContent?.trim().toLowerCase() === 'symbol:';
      });

      if (symbolRow) {
        const symbolCell = symbolRow.querySelector('td[align="left"] b');
        fullSymbol = symbolCell?.textContent?.trim() || 'Unknown';
      }
    }
  }

  // Extract the first 6 characters which is typically the symbol code
  // For example, XAUUSD, EURUSD, etc.
  return fullSymbol.substring(0, 6);
};

const extractTrades = (doc: Document, platform: 'MT4' | 'MT5'): Trade[] => {
  const trades: Trade[] = [];
  
  const tableRows = Array.from(doc.querySelectorAll('tr'));
  
  for (const row of tableRows) {
    const cells = Array.from(row.querySelectorAll('td'));
    if (cells.length < 8) continue;
    
    const firstCell = cells[0].textContent?.trim();
    if (!firstCell || isNaN(Number(firstCell))) continue;
    
    if (platform === 'MT4') {
      const type = cells[2].textContent?.trim() || '';
      // Check for valid trade types including 's/l'
      if (!['buy', 'sell', 't/p', 's/l'].includes(type.toLowerCase())) continue;
      
      const trade: Trade = {
        time: cells[1].textContent?.trim() || '',
        type: type.toUpperCase(),
        price: cells[5].textContent?.trim() || '',
        takeProfit: cells[7].textContent?.trim() || '',
        stopLoss: cells[6]?.textContent?.trim() || '',  // MT4 typically has Stop Loss in column 6
        balance: cells[9]?.textContent?.trim() || '',
        total: cells[9]?.textContent?.trim() || '',
        profitLoss: cells[8]?.textContent?.trim() || '',
        open: '1',
        convertFX: '1.0000'
      };
      
      trades.push(trade);
    } else {
      // For MT5, check if this is an order row by looking for specific patterns
      let typeIndex = -1;
      for (let i = 0; i < cells.length; i++) {
        const cellText = cells[i].textContent?.trim().toLowerCase() || '';
        if (cellText === 'buy' || cellText === 'sell' || cellText === 'tp' || cellText === 'sl') {
          typeIndex = i;
          break;
        }
      }
      
      if (typeIndex === -1) continue; // Not a trade row
      
      // Once we found the type column, we can map other columns relative to it
      const type = cells[typeIndex].textContent?.trim() || '';
      
      // Normalize type names
      let normalizedType = type.toUpperCase();
      if (normalizedType === 'TP') normalizedType = 'T/P';
      if (normalizedType === 'SL') normalizedType = 'S/L';
      
      // Determine time column (typically 1-2 columns before type)
      const timeIndex = Math.max(0, typeIndex - 1);
      
      // Price is typically 2-3 columns after type
      const priceIndex = typeIndex + 3;
      
      // Take profit and stop loss positions can vary in MT5 reports
      // We'll try to find them by looking for columns with numeric values
      let takeProfitIndex = -1;
      let stopLossIndex = -1;
      
      // Look for numeric values in columns after price
      for (let i = priceIndex + 1; i < cells.length - 3; i++) {
        const cellText = cells[i]?.textContent?.trim() || '';
        if (cellText && !isNaN(parseFloat(cellText))) {
          if (takeProfitIndex === -1) {
            takeProfitIndex = i;
          } else if (stopLossIndex === -1) {
            stopLossIndex = i;
            break;
          }
        }
      }
      
      // Fallback to relative positions if not found
      if (takeProfitIndex === -1) takeProfitIndex = priceIndex + 2;
      if (stopLossIndex === -1) stopLossIndex = takeProfitIndex + 1;
      
      // Balance is usually near the end
      const balanceIndex = cells.length - 3;
      
      // Profit/Loss is usually 1-2 columns before balance
      const profitLossIndex = balanceIndex - 1;
      
      const trade: Trade = {
        time: cells[timeIndex].textContent?.trim() || '',
        type: normalizedType,
        price: cells[priceIndex]?.textContent?.trim() || '',
        takeProfit: cells[takeProfitIndex]?.textContent?.trim() || '',
        stopLoss: cells[stopLossIndex]?.textContent?.trim() || '',
        balance: cells[balanceIndex]?.textContent?.trim() || '',
        total: cells[balanceIndex]?.textContent?.trim() || '',
        profitLoss: cells[profitLossIndex]?.textContent?.trim() || '',
        open: '1',
        convertFX: '1.0000'
      };
      
      // For S/L trades, ensure stopLoss has the right value
      if (normalizedType === 'S/L' && trade.stopLoss === '') {
        trade.stopLoss = trade.price; // Use the executed price as the stop loss for S/L trades
      }
      
      trades.push(trade);
    }
  }
  
  return trades;
};

const calculateMetrics = (trades: Trade[]): Metrics => {
  // Include both T/P and S/L trades in the calculations
  const closedTrades = trades.filter(t => 
    t.type.toLowerCase() === 't/p' || t.type.toLowerCase() === 's/l'
  );
  const totalClosedTrades = closedTrades.length || 1; // Avoid division by zero
  
  const winningTrades = closedTrades.filter(t => parseFloat(t.profitLoss || '0') > 0).length;
  const losingTrades = closedTrades.filter(t => parseFloat(t.profitLoss || '0') < 0).length;
  
  const winRate = ((winningTrades / totalClosedTrades) * 100).toFixed(1) + '%';
  
  const totalProfitLoss = trades.reduce((sum, trade) => {
    return sum + parseFloat(trade.profitLoss || '0');
  }, 0).toFixed(2);
  
  const profits = trades
    .filter(t => parseFloat(t.profitLoss || '0') > 0)
    .map(t => parseFloat(t.profitLoss || '0'));
  
  const losses = trades
    .filter(t => parseFloat(t.profitLoss || '0') < 0)
    .map(t => parseFloat(t.profitLoss || '0'));
  
  const avgProfit = profits.length > 0 
    ? (profits.reduce((sum, val) => sum + val, 0) / profits.length).toFixed(2) 
    : '0.00';
    
  const avgLoss = losses.length > 0 
    ? (losses.reduce((sum, val) => sum + val, 0) / losses.length).toFixed(2) 
    : '0.00';
  
  let maxDrawdown = 0;
  let peak = 0;
  let balance = 100000;
  
  for (const trade of trades) {
    balance += parseFloat(trade.profitLoss || '0');
    if (balance > peak) {
      peak = balance;
    }
    const drawdown = peak > 0 ? ((peak - balance) / peak) * 100 : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  const totalProfit = profits.reduce((sum, val) => sum + val, 0);
  const totalLoss = Math.abs(losses.reduce((sum, val) => sum + val, 0));
  const profitFactor = (totalLoss === 0 ? totalProfit : totalProfit / totalLoss).toFixed(2);
  
  return {
    totalTrades: trades.length,
    winningTrades,
    losingTrades,
    winRate,
    totalProfitLoss: '$' + totalProfitLoss,
    avgProfit: '$' + avgProfit,
    avgLoss,
    maxDrawdown: maxDrawdown.toFixed(2) + '%',
    profitFactor,
    sharpRatio: '1.8'
  };
};