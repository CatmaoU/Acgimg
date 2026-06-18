// proxyConfig.js
function getProxyBase() {
    const origin = window.location.origin;
    // 本地环境走3001端口，路径和线上统一为 /api/proxy
    if (origin === 'file://' || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return 'http://127.0.0.1:3001/api/proxy';
    }
    // 线上环境走自有域名
    return 'https://www.imuli.love/api/proxy';
}