INSERT INTO factor_definitions (id, code, name, category, description, formula, version, source_type, status, created_at, updated_at)
VALUES
('fct_builtin_mom20', 'MOM_20D', '20日动量 (MOM_20D)', 'momentum', '20个交易日的累计收益率。', 'CLOSE / Delay(CLOSE, 20) - 1', 1, 'builtin', 'active', datetime('now'), datetime('now')),
('fct_builtin_mom60', 'MOM_60D', '60日动量 (MOM_60D)', 'momentum', '60个交易日的累计收益率。', 'CLOSE / Delay(CLOSE, 60) - 1', 1, 'builtin', 'active', datetime('now'), datetime('now')),
('fct_builtin_rev5', 'REV_5D', '5日反转 (REV_5D)', 'momentum', '5个交易日累计收益率取反，捕捉短期超跌反弹。', '0 - (CLOSE / Delay(CLOSE, 5) - 1)', 1, 'builtin', 'active', datetime('now'), datetime('now')),
('fct_builtin_vol20', 'VOL_20D', '20日波动率 (VOL_20D)', 'volatility', '过去20个交易日日收益率的标准差。', 'TsStd(CLOSE / Delay(CLOSE, 1) - 1, 20)', 1, 'builtin', 'active', datetime('now'), datetime('now')),
('fct_builtin_lowvol20', 'LOW_VOL_20D', '20日低波动率 (LOW_VOL_20D)', 'volatility', '过去20个交易日日收益率的标准差取负，值越大代表波动越低。', '0 - TsStd(CLOSE / Delay(CLOSE, 1) - 1, 20)', 1, 'builtin', 'active', datetime('now'), datetime('now')),
('fct_builtin_volumemom20', 'VOLUME_MOM_20D', '20日成交量动量 (VOLUME_MOM_20D)', 'volume', '5日均量与20日均量之比，反映近期交投活跃度变化。', 'TsMean(VOLUME, 5) / TsMean(VOLUME, 20) - 1', 1, 'builtin', 'active', datetime('now'), datetime('now'));
