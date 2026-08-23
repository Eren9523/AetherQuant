# Penguin Quant 严格回测规则与仿真标准 (Backtest Rules)

## 1. A股市场规则执行标准 (CN Market Rules)
1. **T+1 交易限制**：
   - 当日买入的股票，在当日结算时 `availableShares = 0`，仅在次日开盘起才允许被撮合卖出。
2. **交易手数约束 (Lot Size)**：
   - 股票买入数量必须为 100 股（1手）的整数倍；卖出时若清仓允许零股卖出。
3. **税费与成本扣减**：
   - **印花税**：单边卖出收取 `0.05%`（2023年最新法定标准）。
   - **券商佣金**：双边收取 `0.03%`，单笔最低 `5.00 CNY`。
   - **执行滑点**：双边基准扣减 `0.05%`。
4. **防未来函数原则 (No Lookahead Bias)**：
   - 因子特征与调仓信号仅基于截面 $t$ 日收盘数据计算；
   - 订单撮合于 $t+1$ 日开盘价或分时均价执行。

## 2. 绩效指标数学定义
- **年化收益率**：$$\text{AnnReturn} = \text{TotalReturn} \times \frac{250}{N_{\text{days}}}$$
- **夏普比率**：$$\text{Sharpe} = \frac{\text{AnnReturn} - R_f}{\text{AnnVol}}$$ (其中 $R_f = 2.0\%$)
- **最大回撤**：$$\text{MaxDrawdown} = \max_{t} \left( \frac{\text{Peak}_t - \text{Equity}_t}{\text{Peak}_t} \right)$$
- **卡玛比率**：$$\text{Calmar} = \frac{\text{AnnReturn}}{\text{MaxDrawdown}}$$
