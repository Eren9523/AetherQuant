import React, { useState } from 'react';
import { mockMLModels } from '../../mocks/mockMLModels';
import { TestTube, Play, Loader2, Cpu, Sliders, CheckCircle2 } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export const MLLabView: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState(mockMLModels[0]);
  const [isTraining, setIsTraining] = useState(false);

  // Hyperparameters
  const [epochs, setEpochs] = useState(30);
  const [learningRate, setLearningRate] = useState('0.001');
  const [batchSize, setBatchSize] = useState(128);

  const lossHistory = [
    { epoch: 1, loss: 0.85, valLoss: 0.88 },
    { epoch: 5, loss: 0.62, valLoss: 0.65 },
    { epoch: 10, loss: 0.45, valLoss: 0.49 },
    { epoch: 15, loss: 0.32, valLoss: 0.38 },
    { epoch: 20, loss: 0.24, valLoss: 0.31 },
    { epoch: 25, loss: 0.18, valLoss: 0.28 },
    { epoch: 30, loss: 0.15, valLoss: 0.26 },
  ];

  const featureImportance = [
    { feature: 'MOM_60D', weight: 0.28 },
    { feature: 'ROE_TTM', weight: 0.22 },
    { feature: 'LOW_VOL_20D', weight: 0.19 },
    { feature: 'EP_TTM', weight: 0.15 },
    { feature: 'ANALYST_REVISION', weight: 0.10 },
    { feature: 'VOL_SPIKE', weight: 0.06 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="p-6 bg-white rounded-2xl border border-neutral-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
              <TestTube className="w-4 h-4 text-indigo-600" />
              机器学习 Alpha 实验实验室 (ML Model Training Sandbox)
            </h2>
            <p className="text-xs text-neutral-400">设置 Out-of-Sample 训练集与验证集，防止模型过拟合</p>
          </div>

          <button
            onClick={() => {
              setIsTraining(true);
              setTimeout(() => setIsTraining(false), 2000);
            }}
            disabled={isTraining}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isTraining ? <Loader2 className="w-4 h-4 animate-spin text-amber-300" /> : <Play className="w-4 h-4 text-amber-300" />}
            <span>{isTraining ? '正在反向传播训练中...' : '重新训练 Epochs'}</span>
          </button>
        </div>

        {/* Models Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mockMLModels.map((m) => (
            <div
              key={m.id}
              onClick={() => setSelectedModel(m)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all space-y-3 ${
                selectedModel.id === m.id
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-md'
                  : 'bg-neutral-50 text-neutral-800 border-neutral-200 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{m.name}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-amber-300">
                  {m.type}
                </span>
              </div>
              <div className="text-xs opacity-80 line-clamp-2">{m.description}</div>
              <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-neutral-700/40">
                <span>Acc: <strong>{m.accuracy}%</strong></span>
                <span>IC: <strong>{m.ic}</strong></span>
                <span>RankIC: <strong className="text-emerald-400">{m.rankIc}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* Hyperparameters Config */}
        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/60 space-y-3">
          <h3 className="text-xs font-bold text-neutral-900 flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-neutral-600" />
            模型超参数设定 (Hyperparameters)
          </h3>
          <div className="grid grid-cols-3 gap-4 text-xs font-sans">
            <div>
              <label className="text-neutral-500 block mb-1">Epochs 训练轮数</label>
              <input
                type="number"
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full p-2 bg-white border border-neutral-200 rounded-lg font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-neutral-500 block mb-1">Learning Rate 学习率</label>
              <input
                type="text"
                value={learningRate}
                onChange={(e) => setLearningRate(e.target.value)}
                className="w-full p-2 bg-white border border-neutral-200 rounded-lg font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-neutral-500 block mb-1">Batch Size</label>
              <input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full p-2 bg-white border border-neutral-200 rounded-lg font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Charts Row: Loss & Feature Importance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-100">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-neutral-900">模型收敛 Loss & Validation Loss 损失曲线</h3>
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lossHistory}>
                  <XAxis dataKey="epoch" stroke="#a3a3a3" fontSize={10} tickLine={false} />
                  <YAxis stroke="#a3a3a3" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#171717', borderRadius: '10px', color: '#fff', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="loss" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="valLoss" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-neutral-900">因子特征贡献度 (Feature Importance Weights)</h3>
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureImportance} layout="vertical">
                  <XAxis type="number" stroke="#a3a3a3" fontSize={10} tickLine={false} />
                  <YAxis dataKey="feature" type="category" stroke="#a3a3a3" fontSize={10} tickLine={false} width={90} />
                  <Tooltip contentStyle={{ backgroundColor: '#171717', borderRadius: '10px', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="weight" fill="#171717" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
