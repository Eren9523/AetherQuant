import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  UTCTimestamp,
  Time,
} from 'lightweight-charts';
import { KLinePoint, MarketColorMode } from '../../types';
import { useApp } from '../../context/AppContext';

interface StockCandlestickChartProps {
  data: KLinePoint[];
  colorMode?: MarketColorMode;
  overlayIndicator?: 'MA' | 'EMA' | 'BOLL' | 'NONE';
  subIndicator?: 'VOL' | 'MACD' | 'RSI' | 'KDJ' | 'NONE';
  onOverlayChange?: (ind: 'MA' | 'EMA' | 'BOLL' | 'NONE') => void;
  onSubChange?: (ind: 'VOL' | 'MACD' | 'RSI' | 'KDJ' | 'NONE') => void;
  height?: number;
}

export const StockCandlestickChart: React.FC<StockCandlestickChartProps> = ({
  data,
  colorMode = 'CN',
  overlayIndicator = 'MA',
  subIndicator = 'VOL',
  onOverlayChange,
  onSubChange,
  height = 420,
}) => {
  const { dateFormat, timeFormat } = useApp();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lineSeries1Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const lineSeries2Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const lineSeries3Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const lineSeries4Ref = useRef<ISeriesApi<'Line'> | null>(null);

  // Sub-chart series refs
  const subHistSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const subLine1Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const subLine2Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const subLine3Ref = useRef<ISeriesApi<'Line'> | null>(null);

  // Active hover legend
  const [hoveredBar, setHoveredBar] = useState<KLinePoint | null>(null);

  // Colors based on market convention
  // CN: Up = Red (#ef4444), Down = Green (#10b981)
  // US: Up = Green (#10b981), Down = Red (#ef4444)
  const upColor = colorMode === 'CN' ? '#ef4444' : '#10b981';
  const downColor = colorMode === 'CN' ? '#10b981' : '#ef4444';

  const parseTime = (timeStr: string): Time => {
    if (!timeStr) return '2025-01-01' as Time;
    const clean = timeStr.trim();
    if (clean.length === 10 && clean.includes('-')) {
      return clean as Time;
    }
    try {
      const ts = Math.floor(new Date(clean.replace(/-/g, '/')).getTime() / 1000);
      if (!isNaN(ts) && ts > 0) {
        return ts as UTCTimestamp;
      }
    } catch {}
    return (clean.slice(0, 10)) as Time;
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create lightweight-chart instance
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      localization: {
        dateFormat: dateFormat.replace('YYYY', 'yyyy').replace('DD', 'dd'),
        timeFormatter: (bizDayOrTimestamp: any) => {
          let date;
          if (typeof bizDayOrTimestamp === 'string') {
            date = new Date(bizDayOrTimestamp);
          } else if (typeof bizDayOrTimestamp === 'number') {
            date = new Date(bizDayOrTimestamp * 1000);
          } else {
            date = new Date(Date.UTC(bizDayOrTimestamp.year, bizDayOrTimestamp.month - 1, bizDayOrTimestamp.day));
          }
          const pad = (n) => n.toString().padStart(2, '0');
          const y = date.getUTCFullYear();
          const M = pad(date.getUTCMonth() + 1);
          const d = pad(date.getUTCDate());
          let h = date.getUTCHours();
          const m = pad(date.getUTCMinutes());
          const dateStr = dateFormat.replace('YYYY', y.toString()).replace('MM', M).replace('DD', d);
          let timeStr = '';
          if (timeFormat === '12h') {
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            timeStr = `${pad(h)}:${m} ${ampm}`;
          } else {
            timeStr = `${pad(h)}:${m}`;
          }
          return `${dateStr} ${timeStr}`;
        }
      },
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#737373',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(229, 229, 229, 0.4)', style: 1 },
        horzLines: { color: 'rgba(229, 229, 229, 0.4)', style: 1 },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#a3a3a3',
          width: 1,
          style: 3,
          labelBackgroundColor: '#171717',
        },
        horzLine: {
          color: '#a3a3a3',
          width: 1,
          style: 3,
          labelBackgroundColor: '#171717',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(229, 229, 229, 0.8)',
        scaleMargins: {
          top: 0.08,
          bottom: subIndicator !== 'NONE' ? 0.32 : 0.08,
        },
      },
      timeScale: {
        borderColor: 'rgba(229, 229, 229, 0.8)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // 1. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: upColor,
      downColor: downColor,
      borderVisible: true,
      borderUpColor: upColor,
      borderDownColor: downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });
    candleSeriesRef.current = candleSeries;

    // Resize observer
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [colorMode, height, dateFormat, timeFormat]);

  // Update Data & Indicators
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries || !data || data.length === 0) return;

    // Sort data ascending by time to prevent chart render bugs
    const sortedData = [...data].sort((a, b) => {
      return new Date(a.time.replace(/-/g, '/')).getTime() - new Date(b.time.replace(/-/g, '/')).getTime();
    });

    // Remove duplicates by time
    const uniqueMap = new Map<string, KLinePoint>();
    sortedData.forEach(d => uniqueMap.set(d.time, d));
    const cleanData = Array.from(uniqueMap.values());

    // Candlestick data points
    const candlePoints = cleanData.map(d => ({
      time: parseTime(d.time),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candleSeries.setData(candlePoints);

    // Clean old overlays
    if (lineSeries1Ref.current) { chart.removeSeries(lineSeries1Ref.current); lineSeries1Ref.current = null; }
    if (lineSeries2Ref.current) { chart.removeSeries(lineSeries2Ref.current); lineSeries2Ref.current = null; }
    if (lineSeries3Ref.current) { chart.removeSeries(lineSeries3Ref.current); lineSeries3Ref.current = null; }
    if (lineSeries4Ref.current) { chart.removeSeries(lineSeries4Ref.current); lineSeries4Ref.current = null; }

    // Clean old sub-indicators
    if (volumeSeriesRef.current) { chart.removeSeries(volumeSeriesRef.current); volumeSeriesRef.current = null; }
    if (subHistSeriesRef.current) { chart.removeSeries(subHistSeriesRef.current); subHistSeriesRef.current = null; }
    if (subLine1Ref.current) { chart.removeSeries(subLine1Ref.current); subLine1Ref.current = null; }
    if (subLine2Ref.current) { chart.removeSeries(subLine2Ref.current); subLine2Ref.current = null; }
    if (subLine3Ref.current) { chart.removeSeries(subLine3Ref.current); subLine3Ref.current = null; }

    // Apply Overlays
    if (overlayIndicator === 'MA') {
      const s1 = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, title: 'MA5', crosshairMarkerVisible: false });
      const s2 = chart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, title: 'MA10', crosshairMarkerVisible: false });
      const s3 = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, title: 'MA20', crosshairMarkerVisible: false });
      const s4 = chart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 1, title: 'MA60', crosshairMarkerVisible: false });

      s1.setData(cleanData.filter(d => d.ma5 !== undefined).map(d => ({ time: parseTime(d.time), value: d.ma5! })));
      s2.setData(cleanData.filter(d => d.ma10 !== undefined).map(d => ({ time: parseTime(d.time), value: d.ma10! })));
      s3.setData(cleanData.filter(d => d.ma20 !== undefined).map(d => ({ time: parseTime(d.time), value: d.ma20! })));
      s4.setData(cleanData.filter(d => d.ma60 !== undefined).map(d => ({ time: parseTime(d.time), value: d.ma60! })));

      lineSeries1Ref.current = s1;
      lineSeries2Ref.current = s2;
      lineSeries3Ref.current = s3;
      lineSeries4Ref.current = s4;
    } else if (overlayIndicator === 'EMA') {
      const s1 = chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 1, title: 'EMA12', crosshairMarkerVisible: false });
      const s2 = chart.addSeries(LineSeries, { color: '#ec4899', lineWidth: 1, title: 'EMA26', crosshairMarkerVisible: false });

      s1.setData(cleanData.filter(d => d.ema12 !== undefined).map(d => ({ time: parseTime(d.time), value: d.ema12! })));
      s2.setData(cleanData.filter(d => d.ema26 !== undefined).map(d => ({ time: parseTime(d.time), value: d.ema26! })));

      lineSeries1Ref.current = s1;
      lineSeries2Ref.current = s2;
    } else if (overlayIndicator === 'BOLL') {
      const s1 = chart.addSeries(LineSeries, { color: '#6366f1', lineWidth: 1, title: 'UPPER', crosshairMarkerVisible: false });
      const s2 = chart.addSeries(LineSeries, { color: '#eab308', lineWidth: 1, title: 'MID', crosshairMarkerVisible: false });
      const s3 = chart.addSeries(LineSeries, { color: '#6366f1', lineWidth: 1, title: 'LOWER', crosshairMarkerVisible: false });

      s1.setData(cleanData.filter(d => d.bollUpper !== undefined).map(d => ({ time: parseTime(d.time), value: d.bollUpper! })));
      s2.setData(cleanData.filter(d => d.bollMid !== undefined).map(d => ({ time: parseTime(d.time), value: d.bollMid! })));
      s3.setData(cleanData.filter(d => d.bollLower !== undefined).map(d => ({ time: parseTime(d.time), value: d.bollLower! })));

      lineSeries1Ref.current = s1;
      lineSeries2Ref.current = s2;
      lineSeries3Ref.current = s3;
    }

    // Apply Sub-Indicators
    if (subIndicator === 'VOL') {
      const volSeries = chart.addSeries(HistogramSeries, {
        color: '#94a3b8',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume_scale',
      });
      chart.priceScale('volume_scale').applyOptions({
        scaleMargins: {
          top: 0.75,
          bottom: 0,
        },
      });

      const volPoints = cleanData.map(d => {
        const isUp = d.close >= d.open;
        return {
          time: parseTime(d.time),
          value: d.volume,
          color: isUp ? (colorMode === 'CN' ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)') : (colorMode === 'CN' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'),
        };
      });
      volSeries.setData(volPoints);
      volumeSeriesRef.current = volSeries;
    } else if (subIndicator === 'MACD') {
      const histSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: 'sub_scale',
      });
      const difSeries = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
        priceScaleId: 'sub_scale',
      });
      const deaSeries = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 1,
        priceScaleId: 'sub_scale',
      });

      chart.priceScale('sub_scale').applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 },
      });

      const histPoints = cleanData.filter(d => d.macdHist !== undefined).map(d => ({
        time: parseTime(d.time),
        value: d.macdHist!,
        color: d.macdHist! >= 0 ? upColor : downColor,
      }));
      const difPoints = cleanData.filter(d => d.macd !== undefined).map(d => ({
        time: parseTime(d.time),
        value: d.macd!,
      }));
      const deaPoints = cleanData.filter(d => d.macdSignal !== undefined).map(d => ({
        time: parseTime(d.time),
        value: d.macdSignal!,
      }));

      histSeries.setData(histPoints);
      difSeries.setData(difPoints);
      deaSeries.setData(deaPoints);

      subHistSeriesRef.current = histSeries;
      subLine1Ref.current = difSeries;
      subLine2Ref.current = deaSeries;
    } else if (subIndicator === 'RSI') {
      const rsi6Series = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
        priceScaleId: 'sub_scale',
      });
      const rsi12Series = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 1,
        priceScaleId: 'sub_scale',
      });

      chart.priceScale('sub_scale').applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 },
      });

      rsi6Series.setData(cleanData.filter(d => d.rsi6 !== undefined).map(d => ({ time: parseTime(d.time), value: d.rsi6! })));
      rsi12Series.setData(cleanData.filter(d => d.rsi12 !== undefined).map(d => ({ time: parseTime(d.time), value: d.rsi12! })));

      subLine1Ref.current = rsi6Series;
      subLine2Ref.current = rsi12Series;
    } else if (subIndicator === 'KDJ') {
      const kSeries = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, priceScaleId: 'sub_scale' });
      const dSeries = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, priceScaleId: 'sub_scale' });
      const jSeries = chart.addSeries(LineSeries, { color: '#ec4899', lineWidth: 1, priceScaleId: 'sub_scale' });

      chart.priceScale('sub_scale').applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 },
      });

      kSeries.setData(cleanData.filter(d => d.kdjK !== undefined).map(d => ({ time: parseTime(d.time), value: d.kdjK! })));
      dSeries.setData(cleanData.filter(d => d.kdjD !== undefined).map(d => ({ time: parseTime(d.time), value: d.kdjD! })));
      jSeries.setData(cleanData.filter(d => d.kdjJ !== undefined).map(d => ({ time: parseTime(d.time), value: d.kdjJ! })));

      subLine1Ref.current = kSeries;
      subLine2Ref.current = dSeries;
      subLine3Ref.current = jSeries;
    }

    // Default hover bar to latest bar
    setHoveredBar(cleanData[cleanData.length - 1]);

    // Crosshair subscribe
    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData.get(candleSeries)) {
        setHoveredBar(cleanData[cleanData.length - 1]);
        return;
      }
      const rawTime = param.time;
      const matched = cleanData.find(d => {
        const pt = parseTime(d.time);
        return pt === rawTime;
      });
      if (matched) {
        setHoveredBar(matched);
      }
    });

    // Auto-fit content
    chart.timeScale().fitContent();
  }, [data, overlayIndicator, subIndicator, colorMode]);

  const activeBar = hoveredBar || (data && data.length > 0 ? data[data.length - 1] : null);

  const formatHoverTime = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      
      const pad = (n) => n.toString().padStart(2, '0');
      const y = date.getFullYear();
      const M = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      let h = date.getHours();
      const m = pad(date.getMinutes());
      
      const datePart = dateFormat.replace('YYYY', y.toString()).replace('MM', M).replace('DD', d);
      
      let timePart = '';
      if (timeFormat === '12h') {
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        timePart = `${pad(h)}:${m} ${ampm}`;
      } else {
        timePart = `${pad(h)}:${m}`;
      }
      
      // Only append time if it has time components
      if (timeStr.includes(':') || timeStr.includes('T')) {
        return `${datePart} ${timePart}`;
      }
      return datePart;
    } catch (e) {
      return timeStr;
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Indicator Selection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-neutral-100 pb-2.5">
        <div className="flex items-center gap-4">
          {/* Main Chart Overlays */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-neutral-400 font-mono">主图指标:</span>
            {(['MA', 'EMA', 'BOLL', 'NONE'] as const).map(ind => (
              <button
                key={ind}
                onClick={() => onOverlayChange && onOverlayChange(ind)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all ${
                  overlayIndicator === ind
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-500 hover:text-neutral-900 bg-neutral-100'
                }`}
              >
                {ind}
              </button>
            ))}
          </div>

          {/* Sub Chart Indicators */}
          <div className="flex items-center gap-1.5 border-l border-neutral-200 pl-4">
            <span className="text-[11px] font-bold text-neutral-400 font-mono">副图指标:</span>
            {(['VOL', 'MACD', 'RSI', 'KDJ', 'NONE'] as const).map(ind => (
              <button
                key={ind}
                onClick={() => onSubChange && onSubChange(ind)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all ${
                  subIndicator === ind
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-500 hover:text-neutral-900 bg-neutral-100'
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        {/* Legend Value Bar */}
        {activeBar && (
          <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-mono text-neutral-600">
            <span>时间: <strong className="text-neutral-900">{formatHoverTime(activeBar.time)}</strong></span>
            <span>开: <strong className="text-neutral-900">{activeBar.open}</strong></span>
            <span>高: <strong className="text-neutral-900">{activeBar.high}</strong></span>
            <span>低: <strong className="text-neutral-900">{activeBar.low}</strong></span>
            <span>收: <strong className="text-neutral-900">{activeBar.close}</strong></span>
            {activeBar.changePct !== undefined && (
              <span>涨跌: <strong className={activeBar.changePct >= 0 ? (colorMode === 'CN' ? 'text-rose-600' : 'text-emerald-600') : (colorMode === 'CN' ? 'text-emerald-600' : 'text-rose-600')}>
                {activeBar.changePct >= 0 ? `+${activeBar.changePct}%` : `${activeBar.changePct}%`}
              </strong></span>
            )}
            <span>量: <strong className="text-neutral-900">{activeBar.volume >= 10000 ? `${(activeBar.volume / 10000).toFixed(1)}万` : activeBar.volume}</strong></span>
          </div>
        )}
      </div>

      {/* Dynamic Indicators Values on Hover */}
      {activeBar && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
          {overlayIndicator === 'MA' && (
            <>
              {activeBar.ma5 !== undefined && <span className="text-amber-500">MA5: {activeBar.ma5}</span>}
              {activeBar.ma10 !== undefined && <span className="text-emerald-500">MA10: {activeBar.ma10}</span>}
              {activeBar.ma20 !== undefined && <span className="text-blue-500">MA20: {activeBar.ma20}</span>}
              {activeBar.ma60 !== undefined && <span className="text-purple-500">MA60: {activeBar.ma60}</span>}
            </>
          )}
          {overlayIndicator === 'EMA' && (
            <>
              {activeBar.ema12 !== undefined && <span className="text-cyan-500">EMA12: {activeBar.ema12}</span>}
              {activeBar.ema26 !== undefined && <span className="text-pink-500">EMA26: {activeBar.ema26}</span>}
            </>
          )}
          {overlayIndicator === 'BOLL' && (
            <>
              {activeBar.bollUpper !== undefined && <span className="text-indigo-500">UPPER: {activeBar.bollUpper}</span>}
              {activeBar.bollMid !== undefined && <span className="text-yellow-600">MID: {activeBar.bollMid}</span>}
              {activeBar.bollLower !== undefined && <span className="text-indigo-500">LOWER: {activeBar.bollLower}</span>}
            </>
          )}
          {subIndicator === 'MACD' && (
            <>
              {activeBar.macd !== undefined && <span className="text-amber-500">DIF: {activeBar.macd}</span>}
              {activeBar.macdSignal !== undefined && <span className="text-blue-500">DEA: {activeBar.macdSignal}</span>}
              {activeBar.macdHist !== undefined && <span className="text-neutral-800">MACD: {activeBar.macdHist}</span>}
            </>
          )}
          {subIndicator === 'RSI' && (
            <>
              {activeBar.rsi6 !== undefined && <span className="text-amber-500">RSI6: {activeBar.rsi6}</span>}
              {activeBar.rsi12 !== undefined && <span className="text-blue-500">RSI12: {activeBar.rsi12}</span>}
            </>
          )}
          {subIndicator === 'KDJ' && (
            <>
              {activeBar.kdjK !== undefined && <span className="text-amber-500">K: {activeBar.kdjK}</span>}
              {activeBar.kdjD !== undefined && <span className="text-blue-500">D: {activeBar.kdjD}</span>}
              {activeBar.kdjJ !== undefined && <span className="text-pink-500">J: {activeBar.kdjJ}</span>}
            </>
          )}
        </div>
      )}

      {/* Chart Canvas */}
      <div
        ref={chartContainerRef}
        className="w-full rounded-xl overflow-hidden relative"
        style={{ minHeight: `${height}px` }}
      />
    </div>
  );
};
