const fs = require('fs');
const path = './src/components/workspace/StockCandlestickChart.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add format function for activeBar.time
if (!content.includes('formatHoverTime')) {
  content = content.replace(
    "const activeBar = hoveredBar || (data && data.length > 0 ? data[data.length - 1] : null);",
    `const activeBar = hoveredBar || (data && data.length > 0 ? data[data.length - 1] : null);

  const formatHoverTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr;
      
      const pad = (n) => n.toString().padStart(2, '0');
      const y = date.getFullYear();
      const M = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      let h = date.getHours();
      const m = pad(date.getMinutes());
      
      const datePart = dateFormat.replace('YYYY', y.toString()).replace('MM', M).replace('DD', d);
      
      let timePart = '';
      if (timeFormat === '12h') {
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        timePart = \`\${pad(h)}:\${m} \${ampm}\`;
      } else {
        timePart = \`\${pad(h)}:\${m}\`;
      }
      
      // Only append time if it has time components
      if (timeStr.includes(':') || timeStr.includes('T')) {
        return \`\${datePart} \${timePart}\`;
      }
      return datePart;
    } catch (e) {
      return timeStr;
    }
  };`
  );

  content = content.replace(
    /\{activeBar\.time\}/g,
    "{formatHoverTime(activeBar.time)}"
  );
}

fs.writeFileSync(path, content);
