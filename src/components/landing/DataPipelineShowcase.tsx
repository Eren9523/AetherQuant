import React, { useState } from 'react';
import { Database, UploadCloud, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { mockDataSources } from '../../mocks/mockDataSources';
import { useApp } from '../../context/AppContext';
import { useCountUp } from '../../utils/useCountUp';

export const DataPipelineShowcase: React.FC = () => {
  const { enterWorkspaceWithTransition } = useApp();
  const [dragActive, setDragActive] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  // Animated numbers from 1 to actual count
  const tushareStockCount = useCountUp({ end: 5382, duration: 2000 });
  const usStockCount = useCountUp({ end: 3210, duration: 2000 });
  const secReportCount = useCountUp({ end: 48200, duration: 2200 });
  const uploadedRowCount = useCountUp({ end: 705893, duration: 2500, enabled: uploaded });
  const scoreNumber = (useCountUp({ end: 987, duration: 1800 }) / 10).toFixed(1);

  return (
    <section id="data" className="py-24 px-6 bg-[#f8f9fa] border-t border-neutral-200/60">
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-semibold font-mono text-blue-600 tracking-widest uppercase">
            DATA PIPELINE & BYOD
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
            研究的质量，取决于数据的质量。
          </h2>
          <p className="text-sm text-neutral-500">
            内置 Tushare, QMT, SEC 机构级全量数据源，同时支持导入您自己的 CSV、Excel、PDF 与 Word 因子文档。
          </p>
        </div>

        {/* Data Sources Grid + Bring Your Own Data Dropzone */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Preset Sources */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" />
                内置机构级数据网关
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 transition-all">
                数据质量评分: {scoreNumber}/100
              </span>
            </div>

            <div className="space-y-3">
              {mockDataSources.map((ds) => {
                let displayItemCount = ds.itemCount;
                if (ds.id === 'ds_tushare') {
                  displayItemCount = `${tushareStockCount.toLocaleString()}只股票 / 12,840,920条`;
                } else if (ds.id === 'ds_us_market') {
                  displayItemCount = `${usStockCount.toLocaleString()}只美股 / 8,920,100条`;
                } else if (ds.id === 'ds_sec_edgar') {
                  displayItemCount = `${secReportCount.toLocaleString()}份 PDF / 结构化 XML`;
                }

                return (
                  <div
                    key={ds.id}
                    className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60 hover:bg-neutral-100/80 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-neutral-900 flex items-center gap-2">
                        {ds.name}
                        <span
                          className={`w-2 h-2 rounded-full ${
                            ds.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'
                          }`}
                        />
                      </div>
                      <div className="text-[11px] text-neutral-500 font-mono mt-0.5 group-hover:text-blue-600 transition-colors">
                        {displayItemCount}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-neutral-400 block">同步于</span>
                      <span className="text-xs font-mono text-neutral-700">{ds.lastSync}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BYOD Dropzone */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2 mb-1">
                <UploadCloud className="w-4 h-4 text-indigo-600" />
                使用你自己的数据 (BYOD)
              </h3>
              <p className="text-xs text-neutral-500">
                拖入 CSV / XLSX / PDF / DOCX 文件，系统将自动识别列字段与时间序列。
              </p>
            </div>

            {/* Dropzone Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                setUploaded(true);
              }}
              onClick={() => setUploaded(true)}
              className={`p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center space-y-3 ${
                dragActive || uploaded
                  ? 'border-indigo-500 bg-indigo-50/30 scale-[1.01]'
                  : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100/60 hover:border-neutral-400'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-neutral-200 mx-auto flex items-center justify-center text-indigo-600 transition-transform duration-300 hover:scale-110">
                {uploaded ? <CheckCircle2 className="w-6 h-6 text-emerald-500 animate-bounce" /> : <FileText className="w-6 h-6" />}
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-800">
                  {uploaded ? 'user_factor_matrix_2026.csv 已成功解析' : '点击或将文件拖入此区域'}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1 font-mono">
                  {uploaded ? `${uploadedRowCount.toLocaleString()} 行数据 · 8 个字段自动映射成功` : '支持 CSV, XLSX, PDF, DOCX (最大 500MB)'}
                </div>
              </div>
            </div>

            <button
              onClick={() => enterWorkspaceWithTransition('upload-center')}
              className="w-full py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
            >
              <span>在数据中心查看字段映射 (Schema Mapping)</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

