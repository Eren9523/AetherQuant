const fs = require('fs');
const path = './src/components/workspace/StrategyViews.tsx';
let content = fs.readFileSync(path, 'utf8');

// fetchStrategies
content = content.replace(/await ApiClient\.get\('\/strategies'\)/g, "await ApiClient.get<any[]>('/strategies')");
content = content.replace(/if \(res && res\.data\) {/g, "if (res) {");
content = content.replace(/setStrategies\(res\.data\)/g, "setStrategies(res)");

// fetchFactors
content = content.replace(/await ApiClient\.get\('\/factors'\)/g, "await ApiClient.get<any[]>('/factors')");
content = content.replace(/setFactors\(res\.data\)/g, "setFactors(res)");

// validate
content = content.replace(/await ApiClient\.post\('\/strategies\/validate', currentDsl\)/g, "await ApiClient.post<any>('/strategies/validate', currentDsl)");

// update
content = content.replace(/await ApiClient\.put\(`\/strategies\/\$\{currentStrategyId\}`/g, "await ApiClient.put<any>(`/strategies/${currentStrategyId}`");
content = content.replace(/res && res\.success/g, "res");

// create
content = content.replace(/await ApiClient\.post\('\/strategies'/g, "await ApiClient.post<any>('/strategies'");

fs.writeFileSync(path, content);
