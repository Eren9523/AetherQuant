import unittest
import pandas as pd
import numpy as np
import sys
import os
sys.path.insert(0, os.path.abspath('quant-service'))
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

class TestFactorDSL(unittest.TestCase):
    def test_lookahead_bias(self):
        df = get_dummy_data()
        evaluator = FactorDSLEvaluator(df)
        res_orig = evaluator.eval("TsMean(CLOSE, 3)")
        
        df_mod = df.copy()
        df_mod.loc[(df.index.levels[0][8], '000001.SZ'), 'CLOSE'] = 9999.0
        evaluator_mod = FactorDSLEvaluator(df_mod)
        res_mod = evaluator_mod.eval("TsMean(CLOSE, 3)")
        
        val_orig = res_orig.loc[(df.index.levels[0][7], '000001.SZ')]
        val_mod = res_mod.loc[(df.index.levels[0][7], '000001.SZ')]
        self.assertEqual(val_orig, val_mod, "Lookahead bias detected!")

    def test_eval_safety(self):
        df = get_dummy_data()
        evaluator = FactorDSLEvaluator(df)
        with self.assertRaises(ValueError) as context:
            evaluator.eval("import os; os.system('echo hi')")
        self.assertTrue("Syntax Error" in str(context.exception))
        
        with self.assertRaises(ValueError) as context:
            evaluator.eval("CLOSE ** 2")
        self.assertTrue("FACTOR_OPERATOR_NOT_SUPPORTED" in str(context.exception))

if __name__ == '__main__':
    unittest.main()
