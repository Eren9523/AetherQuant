import os
import sys
sys.path.insert(0, os.path.abspath('quant-service'))
from tests.test_backtest import test_t_plus_1_execution, test_commission_and_slippage

print("Running Backtest Engine tests...")
test_t_plus_1_execution()
print("test_t_plus_1_execution passed")
test_commission_and_slippage()
print("test_commission_and_slippage passed")
