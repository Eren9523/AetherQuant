import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ApiClient } from '../../services/apiClient';
import { Database, UploadCloud, FileText, HardDrive, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';

export const DataCenterView: React.FC = () => {
  const { workspaceView, setWorkspaceView, requireAuth } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'sources' | 'upload' | 'browser'>(
    workspaceView === 'upload-center' ? 'upload' : workspaceView === 'data-browser' ? 'browser' : 'sources'
  );

  useEffect(() => {
    if (workspaceView === 'upload-center') setActiveSubTab('upload');
    else if (workspaceView === 'data-browser') setActiveSubTab('browser');
    else if (workspaceView === 'data-center') setActiveSubTab('sources');
  }, [workspaceView]);

  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [healthData, setHealthData] = useState<any>(null);
  
  const fetchDatasets = async () => {
    try {
      const res = await ApiClient.get('/datasets');
      if (res && res.data) {
        setDatasets(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await ApiClient.get('/market/health');
      if (res && res.data) {
        setHealthData(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDatasets();
    fetchHealth();
  }, []);

  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!requireAuth(() => handleFileUpload(file))) {
      return;
    }
    setIsUploading(true);
    try {
      // 1. Init Upload
      const initRes = await ApiClient.post('/datasets/init-upload', {
        name: file.name,
        filename: file.name,
        size_bytes: file.size,
        format: file.name.split('.').pop(),
        mime_type: file.type
      });

      if (!initRes || !initRes.data?.id) throw new Error("Init upload failed");
      
      const dsId = initRes.data.id;

      // 2. Direct Upload via FormData
      const formData = new FormData();
      formData.append('file', file);
      
      await fetch(`/api/v1/datasets/${dsId}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      await fetchDatasets();
      setActiveSubTab('browser');
    } catch (e) {
      console.error("Upload failed", e);
      alert("Upload failed. File might be too large or server error.");
    }
    setIsUploading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await ApiClient.delete(`/datasets/${id}`);
      await fetchDatasets();
      if (selectedDataset?.id === id) {
        setSelectedDataset(null);
        setPreviewData([]);
      }
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const loadDatasetPreview = async (ds: any) => {
    setSelectedDataset(ds);
    setLoading(true);
    try {
      const res = await ApiClient.get(`/datasets/${ds.id}`);
      if (res && res.data) {
        setSelectedDataset(res.data);
        setPreviewData(res.data.preview || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Data Browser search & filter state
  const [dataSearchTerm, setDataSearchTerm] = useState('');

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
          上传中心 (BYOD)
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
              <div className="text-xs font-semibold text-neutral-400 mb-1">数据库同步状态</div>
              <div className="text-2xl font-extrabold font-mono text-emerald-600">
                {healthData?.status === 'healthy' ? 'Healthy' : healthData?.status || 'Unknown'}
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">
                {healthData?.last_sync_at ? new Date(healthData.last_sync_at).toLocaleString() : '未同步'}
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-400 mb-1">标的总量 (Stocks)</div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {healthData?.stock_count || 0}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">数据库实时读取</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-400 mb-1">数据源 (Provider)</div>
              <div className="text-2xl font-bold font-mono text-neutral-900 capitalize">
                {healthData?.provider || 'none'}
              </div>
              <span className="text-[10px] text-neutral-400">底层服务: {healthData?.source || 'akshare'}</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-400 mb-1">BYOD 存储占用 (R2)</div>
              <div className="text-2xl font-bold font-mono text-neutral-900">
                {(datasets.reduce((acc, ds) => acc + (ds.size_bytes || 0), 0) / (1024 * 1024)).toFixed(2)} MB
              </div>
              <span className="text-[10px] text-neutral-400">已接入 {datasets.length} 个数据集</span>
            </div>
          </div>

          {/* Sources Table */}
          <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              接入行情网关与 API 链路状态
            </h3>

            <div className="space-y-3">
              <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-bold text-neutral-900 flex items-center gap-2 text-sm">
                    {healthData?.provider === 'eastmoney' ? '东方财富 (EastMoney)' : '核心行情数据'}
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-mono font-semibold border ${
                        healthData?.status === 'healthy'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-neutral-200 text-neutral-600 border-neutral-300'
                      }`}
                    >
                      {healthData?.status === 'healthy' ? '● 在线' : '○ 未连接/过时'}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 font-mono">包含 {healthData?.stock_count || 0} 只标的</div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-neutral-400 font-mono">上次同步 (Active Snapshot)</div>
                  <div className="text-xs font-bold text-neutral-800 font-mono">
                    {healthData?.active_snapshot_as_of ? new Date(healthData.active_snapshot_as_of).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
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
              支持上传自定义 CSV / XLSX / JSON 数据集，由 Python 服务进行解析并生成 Schema 映射，原文件安全存储于 Cloudflare R2。
            </p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`p-10 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/20'
                : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100/60'
            }`}
          >
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              accept=".csv,.xlsx,.xls,.parquet,.json"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }} 
            />
            <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 shadow-sm mx-auto flex items-center justify-center text-indigo-600 mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-neutral-800">
              {isUploading
                ? '正在上传并解析中，请稍候...'
                : '拖入 CSV/XLSX/Parquet/JSON 文件，或点击浏览文件'}
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              支持最大 500MB 文件 · 自动执行格式校验、Schema 推断及 R2 转换
            </div>
          </div>
          
          {datasets.length > 0 && (
            <div className="pt-4 space-y-3">
              <h4 className="text-xs font-bold text-neutral-900">已上传的数据集</h4>
              <div className="space-y-2">
                {datasets.map(ds => (
                  <div key={ds.id} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-bold">{ds.name}</div>
                      <div className="text-xs text-neutral-500 flex gap-2">
                        <span>格式: {ds.format}</span>
                        <span>大小: {(ds.size_bytes / 1024).toFixed(1)} KB</span>
                        <span>状态: {ds.status}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); loadDatasetPreview(ds); setActiveSubTab('browser'); }} className="text-xs px-3 py-1 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 text-neutral-700">查看</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(ds.id); }} className="text-xs px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center"><Trash2 className="w-3 h-3 mr-1" /> 删除</button>
                    </div>
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
            <div className="flex items-center gap-3">
               <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                 <HardDrive className="w-4 h-4 text-neutral-600" />
                 数据浏览器
               </h3>
               {datasets.length > 0 && (
                 <select 
                   className="text-xs border border-neutral-200 rounded px-2 py-1 bg-neutral-50"
                   value={selectedDataset?.id || ''}
                   onChange={(e) => {
                     const ds = datasets.find(d => d.id === e.target.value);
                     if (ds) loadDatasetPreview(ds);
                   }}
                 >
                   <option value="">-- 选择数据集 --</option>
                   {datasets.map(ds => <option key={ds.id} value={ds.id}>{ds.name} ({ds.status})</option>)}
                 </select>
               )}
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-neutral-400">显示前 {previewData.length} 行预览 (最大 100 行)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-10 text-center text-xs text-neutral-500">加载中...</div>
            ) : !selectedDataset ? (
              <div className="py-10 text-center text-xs text-neutral-500">请选择一个数据集以浏览</div>
            ) : previewData.length === 0 ? (
              <div className="py-10 text-center text-xs text-neutral-500">此数据集无预览数据或正在解析中</div>
            ) : (
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="text-neutral-400 border-b border-neutral-100 uppercase">
                    {Object.keys(previewData[0]).map((key) => (
                      <th key={key} className="py-2.5 px-3">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-800">
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                      {Object.values(row).map((val: any, vIdx) => (
                        <td key={vIdx} className="py-2.5 px-3 truncate max-w-[200px]" title={String(val)}>{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
