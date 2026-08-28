const fs = require('fs');
const path = './src/components/workspace/StockCandlestickChart.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "const formatHoverTime = (timeStr) => {",
  "const formatHoverTime = (timeStr: string) => {"
);
content = content.replace(
  "timeFormatter: (bizDayOrTimestamp) => {",
  "timeFormatter: (bizDayOrTimestamp: any) => {"
);

fs.writeFileSync(path, content);
