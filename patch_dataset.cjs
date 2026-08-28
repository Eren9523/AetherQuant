const fs = require('fs');
const path = './worker/src/dataset/datasetRoutes.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/const parseRes = await resp\.json\(\);/g, "const parseRes = await resp.json() as any;");

fs.writeFileSync(path, content);
