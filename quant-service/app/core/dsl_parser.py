import ast
import operator
import pandas as pd
import numpy as np

# Safe math operators
ALLOWED_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    #ast.Mult: operator.mul,
    ast.Mult: lambda a, b: a * b,
    ast.Div: operator.truediv,
}

# Known fields
ALLOWED_FIELDS = {'OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOLUME'}

def _safe_div(a, b):
    # to avoid div by zero warnings in pandas
    return a / b.replace(0, np.nan)

ALLOWED_OPERATORS[ast.Div] = _safe_div
ALLOWED_OPERATORS[ast.Mult] = operator.mul

class FactorDSLEvaluator:
    def __init__(self, df: pd.DataFrame):
        # df should be a multi-index (date, symbol) dataframe or we handle grouping
        # assume df is sorted by date
        self.df = df
        
    def eval(self, expr_str: str) -> pd.Series:
        try:
            tree = ast.parse(expr_str, mode='eval')
        except SyntaxError as e:
            raise ValueError(f"Syntax Error in formula: {e}")
            
        return self._eval_node(tree.body)

    def _eval_node(self, node):
        if isinstance(node, ast.Name):
            if node.id.upper() in ALLOWED_FIELDS:
                return self.df[node.id.upper()]
            else:
                raise ValueError(f"FACTOR_OPERATOR_NOT_SUPPORTED: Unknown field or variable {node.id}")
                
        elif isinstance(node, ast.Num): # Python < 3.8
            return node.n
        elif isinstance(node, ast.Constant): # Python >= 3.8
            return node.value
            
        elif isinstance(node, ast.BinOp):
            left = self._eval_node(node.left)
            right = self._eval_node(node.right)
            op = type(node.op)
            if op not in ALLOWED_OPERATORS:
                raise ValueError(f"FACTOR_OPERATOR_NOT_SUPPORTED: Operator {op.__name__}")
            return ALLOWED_OPERATORS[op](left, right)
            
        elif isinstance(node, ast.Call):
            func_name = node.func.id
            args = [self._eval_node(arg) for arg in node.args]
            
            if func_name == 'Delay':
                if len(args) != 2: raise ValueError("Delay takes 2 arguments: Delay(field, window)")
                series, window = args
                return series.groupby(level='symbol').shift(window)
                
            elif func_name == 'Delta':
                if len(args) != 2: raise ValueError("Delta takes 2 arguments: Delta(field, window)")
                series, window = args
                return series - series.groupby(level='symbol').shift(window)
                
            elif func_name == 'TsMean':
                if len(args) != 2: raise ValueError("TsMean takes 2 arguments: TsMean(field, window)")
                series, window = args
                return series.groupby(level='symbol').rolling(window).mean().droplevel(0).sort_index()

            elif func_name == 'TsStd':
                if len(args) != 2: raise ValueError("TsStd takes 2 arguments: TsStd(field, window)")
                series, window = args
                return series.groupby(level='symbol').rolling(window).std().droplevel(0).sort_index()
                
            elif func_name == 'TsMax':
                if len(args) != 2: raise ValueError("TsMax takes 2 arguments: TsMax(field, window)")
                series, window = args
                return series.groupby(level='symbol').rolling(window).max().droplevel(0).sort_index()
                
            elif func_name == 'TsMin':
                if len(args) != 2: raise ValueError("TsMin takes 2 arguments: TsMin(field, window)")
                series, window = args
                return series.groupby(level='symbol').rolling(window).min().droplevel(0).sort_index()
                
            elif func_name == 'TsArgMax':
                if len(args) != 2: raise ValueError("TsArgMax takes 2 arguments: TsArgMax(field, window)")
                series, window = args
                return series.groupby(level='symbol').rolling(window).apply(lambda x: pd.Series(x).argmax() + 1 if len(x)>0 else np.nan, raw=False).droplevel(0).sort_index()

            elif func_name == 'TsArgMin':
                if len(args) != 2: raise ValueError("TsArgMin takes 2 arguments: TsArgMin(field, window)")
                series, window = args
                return series.groupby(level='symbol').rolling(window).apply(lambda x: pd.Series(x).argmin() + 1 if len(x)>0 else np.nan, raw=False).droplevel(0).sort_index()
                
            elif func_name == 'TsRank':
                if len(args) != 2: raise ValueError("TsRank takes 2 arguments: TsRank(field, window)")
                series, window = args
                # Rolling rank across time (for each symbol)
                return series.groupby(level='symbol').rolling(window).apply(lambda x: pd.Series(x).rank().iloc[-1] / len(x) if len(x)>0 else np.nan, raw=False).droplevel(0).sort_index()
                
            elif func_name == 'Rank':
                if len(args) != 1: raise ValueError("Rank takes 1 argument: Rank(field)")
                series = args[0]
                return series.groupby(level='date').rank(pct=True).sort_index()
                
            elif func_name == 'ZScore':
                if len(args) != 1: raise ValueError("ZScore takes 1 argument: ZScore(field)")
                series = args[0]
                def _zscore(x):
                    return (x - x.mean()) / x.std()
                return series.groupby(level='date').apply(_zscore).droplevel(0).sort_index()

            elif func_name == 'Winsorize':
                if len(args) not in (1, 3): raise ValueError("Winsorize takes 1 or 3 arguments: Winsorize(field, lower, upper)")
                series = args[0]
                lower = args[1] if len(args) == 3 else 0.025
                upper = args[2] if len(args) == 3 else 0.975
                def _winsorize(x):
                    q_low = x.quantile(lower)
                    q_high = x.quantile(upper)
                    return x.clip(lower=q_low, upper=q_high)
                return series.groupby(level='date').apply(_winsorize).droplevel(0).sort_index()

            else:
                raise ValueError(f"FACTOR_OPERATOR_NOT_SUPPORTED: {func_name}")
                
        else:
            raise ValueError(f"FACTOR_OPERATOR_NOT_SUPPORTED: AST node type {type(node).__name__}")
