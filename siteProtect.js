// 网页反混淆
(function () {
    // 禁用常用开发者工具快捷键
    document.addEventListener('keydown', function (e) {
        // Ctrl+Shift+I / J / C 开发者工具系列
        if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
            e.preventDefault();
            return false;
        }
        // Ctrl+U 查看源码
        if (e.ctrlKey && e.key.toUpperCase() === 'U') {
            e.preventDefault();
            return false;
        }
    });

    // 开发调试时可以把下面这段注释掉，上线前再打开
    let isConsoleOpen = false;
    function checkConsole() {
        const startTime = performance.now();
        // 利用 debugger 断点耗时检测控制台是否打开
        debugger;
        const cost = performance.now() - startTime;

        // 执行耗时超过100ms，说明控制台已打开且命中了断点
        if (cost > 100 && !isConsoleOpen) {
            isConsoleOpen = true;
            // 可自定义触发行为：提示、跳转、冻结页面
            document.body.innerHTML = '<div style="color:#fff;font-size:18px;text-align:center;padding-top:200px;">请关闭开发者工具后刷新页面喵</div>';
            return;
        }
        setTimeout(checkConsole, 1500);
    }

    // 页面加载完成后启动检测
if (window.addEventListener) {
    window.addEventListener('load', function () {
        // 本地开发环境不启动控制台检测，避免影响调试
        const origin = window.location.origin;
        const isLocal = origin === 'file://' 
            || origin.includes('localhost') 
            || origin.includes('127.0.0.1');
        if (!isLocal) {
            setTimeout(checkConsole, 1000);
        }
    });
}
})();