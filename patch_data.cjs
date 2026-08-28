const fs = require('fs');
const path = './src/components/workspace/DataCenterView.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/initRes\.data\?\.id/g, 'initRes.id');
content = content.replace(/initRes\.data\.id/g, 'initRes.id');
fs.writeFileSync(path, content);
