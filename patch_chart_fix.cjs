const fs = require('fs');
const path = './src/components/workspace/StockCandlestickChart.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "          if (typeof bizDayOrTimestamp === 'number') {",
  "          if (typeof bizDayOrTimestamp === 'string') {\n            date = new Date(bizDayOrTimestamp);\n          } else if (typeof bizDayOrTimestamp === 'number') {"
);

fs.writeFileSync(path, content);
