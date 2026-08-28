const fs = require('fs');
const path = './worker/src/factor/factorRoutes.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/const resJson = await resp\.json\(\);/g, "const resJson = await resp.json() as any;");

fs.writeFileSync(path, content);
