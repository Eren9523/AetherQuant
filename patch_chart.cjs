const fs = require('fs');
const path = './src/components/workspace/StockCandlestickChart.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import useApp
if (!content.includes('useApp')) {
  content = content.replace(
    "import { KLinePoint, MarketColorMode } from '../../types';",
    "import { KLinePoint, MarketColorMode } from '../../types';\nimport { useApp } from '../../context/AppContext';"
  );
}

// 2. Destructure inside component
if (!content.includes('const { dateFormat, timeFormat } = useApp();')) {
  content = content.replace(
    "  const chartContainerRef = useRef<HTMLDivElement>(null);",
    "  const { dateFormat, timeFormat } = useApp();\n  const chartContainerRef = useRef<HTMLDivElement>(null);"
  );
}

// 3. Add localization
if (!content.includes('localization: {')) {
  content = content.replace(
    "layout: {",
    "localization: {\n        dateFormat: dateFormat.replace('YYYY', 'yyyy').replace('DD', 'dd'),\n        timeFormatter: (bizDayOrTimestamp) => {\n          let date;\n          if (typeof bizDayOrTimestamp === 'number') {\n            date = new Date(bizDayOrTimestamp * 1000);\n          } else {\n            date = new Date(Date.UTC(bizDayOrTimestamp.year, bizDayOrTimestamp.month - 1, bizDayOrTimestamp.day));\n          }\n          const pad = (n) => n.toString().padStart(2, '0');\n          const y = date.getUTCFullYear();\n          const M = pad(date.getUTCMonth() + 1);\n          const d = pad(date.getUTCDate());\n          let h = date.getUTCHours();\n          const m = pad(date.getUTCMinutes());\n          const dateStr = dateFormat.replace('YYYY', y.toString()).replace('MM', M).replace('DD', d);\n          let timeStr = '';\n          if (timeFormat === '12h') {\n            const ampm = h >= 12 ? 'PM' : 'AM';\n            h = h % 12 || 12;\n            timeStr = `${pad(h)}:${m} ${ampm}`;\n          } else {\n            timeStr = `${pad(h)}:${m}`;\n          }\n          return `${dateStr} ${timeStr}`;\n        }\n      },\n      layout: {"
  );
}

fs.writeFileSync(path, content);
