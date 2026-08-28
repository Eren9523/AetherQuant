const fs = require('fs');
const path = './src/components/workspace/StockCandlestickChart.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /}, \[colorMode, height\]\);/g,
  "}, [colorMode, height, dateFormat, timeFormat]);"
);

fs.writeFileSync(path, content);
