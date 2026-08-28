const now = new Date();
const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
}).formatToParts(now);
const p = {};
parts.forEach(x => p[x.type] = x.value);
console.log(p);
