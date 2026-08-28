const fs = require('fs');
const path = './src/components/workspace/FactorViews.tsx';
let content = fs.readFileSync(path, 'utf8');

// fetchFactors
content = content.replace(/await ApiClient\.get\('\/factors'\)/g, "await ApiClient.get<any[]>('/factors')");
content = content.replace(/res && res\.data/g, "res");
content = content.replace(/setFactors\(res\.data\)/g, "setFactors(res)");
content = content.replace(/res\.data\.length/g, "res.length");
content = content.replace(/res\.data\[0\]/g, "res[0]");

// createRes
content = content.replace(/await ApiClient\.post\('\/factors',/g, "await ApiClient.post<any>('/factors',");
content = content.replace(/createRes\.data\?\.id/g, "createRes.id");
content = content.replace(/createRes\.data\.id/g, "createRes.id");

// runRes
content = content.replace(/await ApiClient\.post\(`\/factors\/\$\{fId\}\/run`,/g, "await ApiClient.post<any>(`/factors/${fId}/run`,");
content = content.replace(/runRes\.data\?\.run_id/g, "runRes.run_id");
content = content.replace(/runRes\.data\.run_id/g, "runRes.run_id");

// getResults
content = content.replace(/await ApiClient\.get\(`\/factors\/\$\{factorId\}\/runs\/\$\{runId\}\/results`\)/g, "await ApiClient.get<any>(`/factors/${factorId}/runs/${runId}/results`)");
content = content.replace(/setLabData\(res\.data\)/g, "setLabData(res)");

fs.writeFileSync(path, content);
