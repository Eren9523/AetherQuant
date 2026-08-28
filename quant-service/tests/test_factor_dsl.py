import pytest
import pandas as pd
import numpy as np
from app.core.dsl_parser import FactorDSLEvaluator

def get_dummy_data():
    dates = pd.date_range('2023-01-01', periods=10)
    symbols = ['000001.SZ', '000002.SZ']
    idx = pd.MultiIndex.from_product([dates, symbols], names=['date', 'symbol'])
    df = pd.DataFrame({
        'OPEN': np.random.rand(20) * 10 + 100,
        'HIGH': np.random.rand(20) * 10 + 105,
        'LOW': np.random.rand(20) * 10 + 95,
        'CLOSE': np.random.rand(20) * 10 + 100,
        'VOLUME': np.random.rand(20) * 1000 + 10000,
    }, index=idx)
    return df

def test_lookahead_bias():
    df = get_dummy_data()
    evaluator = FactorDSLEvaluator(df)
    
    # Calculate a feature that uses past data, e.g. TsMean(CLOSE, 3)
    res_orig = evaluator.eval("TsMean(CLOSE, 3)")
    
    # Modify future price (e.g. at day 8)
    df_mod = df.copy()
    df_mod.loc[(df.index.levels[0][8], '000001.SZ'), 'CLOSE'] = 9999.0
    evaluator_mod = FactorDSLEvaluator(df_mod)
    res_mod = evaluator_mod.eval("TsMean(CLOSE, 3)")
    
    # The value at day 7 should NOT be affected
    val_orig = res_orig.loc[(df.index.levels[0][7], '000001.SZ')]
    val_mod = res_mod.loc[(df.index.levels[0][7], '000001.SZ')]
    assert val_orig == val_mod, "Lookahead bias detected! Future price affected past feature."

def test_eval_safety():
    df = get_dummy_data()
    evaluator = FactorDSLEvaluator(df)
    
    with pytest.raises(ValueError, match="Syntax Error"):
        evaluator.eval("import os; os.system('echo hi')")
        
    with pytest.raises(ValueError, match="FACTOR_OPERATOR_NOT_SUPPORTED"):
        evaluator.eval("CLOSE ** 2")

def test_basic_operators():
    df = get_dummy_data()
    evaluator = FactorDSLEvaluator(df)
    res = evaluator.eval("CLOSE / OPEN - 1")
    assert not res.empty
