import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { mockDataSources, mockDataQualityStats } from '../../mocks/mockDataSources';
import { DataService } from '../../services/quantServices';
import { Database, UploadCloud, FileText, CheckCircle2, RefreshCw, HardDrive, AlertCircle } from 'lucide-react';

export const DataCenterView: React.FC = () => {
  const { workspaceView, setWorkspaceView, requireAuth } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'sources' | 'upload' | 'browser'>(
    workspaceView === 'upload-center' ? 'upload' : workspaceView === 'data-browser' ? 'browser' : 'sources'
  );

  React.useEffect(() => {
    if (workspaceView === 'upload-center') setActiveSubTab('upload');
    else if (workspaceView === 'data-browser') setActiveSubTab('browser');
    else if (workspaceView === 'data-center') setActiveSubTab('sources');
  }, [workspaceView]);

  const [dragActive, setDragActive] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [datasetInfo, setDatasetInfo] = useState<any>(null);

  // Data Browser search & filter state
  const [dataSearchTerm, setDataSearchTerm] = useState('');
  const [dataGridRows, setDataGridRows] = useState([
    { symbol: '600519.SH', name: '贵州茅台', date: '2026-08-14', open: '1462.00', high: '1490.00', low: '1460.00', close: '1482.35', volume: '42,800', pe: '24.2', status: 'Verified' },
    { symbol: '300750.SZ', name: '宁德时代', date: '2026-08-14', open: '242.00', high: '251.00', low: '241.20', close: '248.60', volume: '285,000', pe: '21.5', status: 'Verified' },
    { symbol: '601318.SH', name: '中国平安', date: '2026-08-14', open: '48.50', high: '49.80', low: '48.20', close: '49.45', volume: '620,000', pe: '8.4', status: 'Verified' },
    { symbol: '002594.SZ', name: '比亚迪', date: '2026-08-14', open: '282.00', high: '289.50', low: '280.00', close: '287.10', volume: '194,000', pe: '18.9', status: 'Verified' },
    { symbol: '600036.SH', name: '招商银行', date: '2026-08-14', open: '38.20', high: '39.10', low: '38.00', close: '38.85', volume: '810,000', pe: '6.2', status: 'Verified' },
    { symbol: 'NVDA.O', name: 'NVIDIA Corp', date: '2026-08-14', open: '138.50', high: '142.20', low: '137.80', close: '141.60', volume: '32,400,000', pe: '38.5', status: 'Verified' },
    { symbol: 'AAPL.O', name: 'Apple Inc', date: '2026-08-14', open: '228.00', high: '231.50', low: '227.20', close: '230.80', volume: '18,500,000', pe: '29.1', status: 'Verified' },
  ]);

  const handleFileUpload = async (fileName: string) => {
    if (!requireAuth(() => handleFileUpload(fileName))) {
      return;
    }
    setIsParsing(true);
    const parsed = await DataService.parseUploadedFile(fileName);
    setDatasetInfo(parsed);
    setIsParsing(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-[2100px] mx-auto animate-in fade-in duration-300">
      {/* Subtabs Menu */}
      <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-3">
        <button
          onClick={() => setActiveSubTab('sources')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'sources' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          数据源与数据质量
        </button>
        <button
          onClick={() => setActiveSubTab('upload')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'upload' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          上传中心 (BYOD Schema Mapping)
        </button>
        <button
          onClick={() => setActiveSubTab('browser')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'browser' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          数据浏览器 (Data Browser)
        </button>
      </div>

      {/* Subtab 1: Sources & Quality */}
      {activeSubTab === 'sources' && (
        <div className="space-y-6">
          {/* Overall Quality Banner */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div>
              <div className="text-xs font-semibold text-neutral-400 mb-1">数据质量综合得分</div>
              <div className="text-3xl font-extrabold font-mono text-emerald-600">
                {mockDataQualityStats.overallScore} / 100
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">上次全量审计: {mockDataQualityStats.lastAudit}</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-400 mb-1">行情记录完整率</div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {mockDataQualityStats.completeness}%
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">健康状态</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-400 mb-1">缺失记录数</div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {mockDataQualityStats.missingRecords} 条
              </div>
              <span className="text-[10px] text-neutral-400">自动对齐修复中</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-400 mb-1">异常极值修正</div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {mockDataQualityStats.anomalyRecords} 条
              </div>
              <span className="text-[10px] text-neutral-400">已执行 MAD 去极值</span>
            </div>
          </div>

          {/* Sources Table */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              接入行情网关与 API 链路状态
            </h3>

            <div className="space-y-3">
              {mockDataSources.map((ds) => (
                <div
                  key={ds.id}
                  className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-neutral-900 flex items-center gap-2 text-sm">
                      {ds.name}
                      <span
                        className={`px-2 py-0.2 rounded text-[10px] font-mono font-semibold border ${
                          ds.status === 'online'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-neutral-200 text-neutral-600 border-neutral-300'
                        }`}
                      >
                        {ds.status === 'online' ? '● 在线' : '○ 未连接'}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 font-mono">{ds.itemCount}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-neutral-400 font-mono">上次同步</div>
                    <div className="text-xs font-bold text-neutral-800 font-mono">{ds.lastSync}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Upload Center (BYOD Schema Mapping) */}
      {activeSubTab === 'upload' && (
        <div className="p-8 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-6">
          <div className="max-w-xl mx-auto text-center space-y-2">
            <h3 className="text-lg font-bold text-neutral-900">带入你自己的数据 (BYOD)</h3>
            <p className="text-xs text-neutral-500">
              支持拖入自定义 CSV / XLSX 因子矩阵，系统将智能识别字段并创建 Schema 映射。
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFileUpload('my_alpha_factor_2026.csv');
            }}
            onClick={() => handleFileUpload('my_alpha_factor_2026.csv')}
            className={`p-10 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all ${
              dragActive || datasetInfo
                ? 'border-indigo-500 bg-indigo-50/20'
                : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100/60'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 shadow-sm mx-auto flex items-center justify-center text-indigo-600 mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-neutral-800">
              {isParsing
                ? '正在解析 705,893 行数据与时间序列...'
                : datasetInfo
                ? `${datasetInfo.filename} 解析成功！`
                : '拖入 CSV/XLSX/PDF 文件，或点击浏览文件'}
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              支持最大 500MB 文件 · 自动执行格式校验与缺失值检测
            </div>
          </div>

          {/* Schema Mapping Table preview */}
          {datasetInfo && (
            <div className="p-5 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">Schema 字段智能映射</h4>
                  <p className="text-[11px] text-neutral-400">
                    数据范围: {datasetInfo.dateRange} · 标的数量: {datasetInfo.symbolCount} 只
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-mono font-semibold rounded-lg">
                  8 / 8 字段映射完美对齐
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                {datasetInfo.fieldMappings.map((m: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-white rounded-lg border border-neutral-200">
                    <span className="text-neutral-400 block text-[10px]">{m.sourceField}</span>
                    <span className="text-neutral-900 font-bold">→ {m.mappedField}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtab 3: Data Browser */}
      {activeSubTab === 'browser' && (
        <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-neutral-600" />
              数据浏览器 (Interactive Data Grid)
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={dataSearchTerm}
                onChange={(e) => setDataSearchTerm(e.target.value)}
                placeholder="搜索代码或股票名称 (如 600519 / 茅台)..."
                className="px-3 py-1.5 bg-neutral-50 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:bg-white w-64"
              />
              <span className="text-xs font-mono text-neutral-400">显示 {dataGridRows.length} 条样本</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-100 uppercase">
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">名称</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Open</th>
                  <th className="py-2.5 px-3">High</th>
                  <th className="py-2.5 px-3">Low</th>
                  <th className="py-2.5 px-3">Close</th>
                  <th className="py-2.5 px-3">PE_TTM</th>
                  <th className="py-2.5 px-3">Volume</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {dataGridRows
                  .filter(
                    (r) =>
                      r.symbol.toLowerCase().includes(dataSearchTerm.toLowerCase()) ||
                      r.name.includes(dataSearchTerm)
                  )
                  .map((r, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-neutral-900">{r.symbol}</td>
                      <td className="py-2.5 px-3 font-sans text-neutral-700">{r.name}</td>
                      <td className="py-2.5 px-3 text-neutral-500">{r.date}</td>
                      <td className="py-2.5 px-3">{r.open}</td>
                      <td className="py-2.5 px-3">{r.high}</td>
                      <td className="py-2.5 px-3">{r.low}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-600">{r.close}</td>
                      <td className="py-2.5 px-3">{r.pe}x</td>
                      <td className="py-2.5 px-3">{r.volume}</td>
                      <td className="py-2.5 px-3 text-emerald-600 font-semibold">● {r.status}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
