(function () {
    // 1. 创建图片容器
    const imgBox = document.createElement('div');
    imgBox.id = 'imgBox';
    const randomImg = document.createElement('img');
    randomImg.id = 'randomImg';
    randomImg.alt = 'pixiv作品';
    const loadingTip = document.createElement('div');
    loadingTip.id = 'loadingTip';
    loadingTip.textContent = '加载中喵..';
    imgBox.appendChild(randomImg);
    imgBox.appendChild(loadingTip);
    // 2. 翻页控制栏
    const pageControl = document.createElement('div');
    pageControl.className = 'page-control';
    const prevBtn = document.createElement('button');
    prevBtn.id = 'prevBtn';
    prevBtn.textContent = '上一页';
    const pageIndicator = document.createElement('span');
    pageIndicator.id = 'pageIndicator';
    pageIndicator.textContent = '<1/0页>';
    const nextBtn = document.createElement('button');
    nextBtn.id = 'nextBtn';
    nextBtn.textContent = '下一页';
    pageControl.appendChild(prevBtn);
    pageControl.appendChild(pageIndicator);
    pageControl.appendChild(nextBtn);
    // 3. 随机按钮组
    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group';
    const getNormal = document.createElement('button');
    getNormal.id = 'getNormal';
    getNormal.textContent = '全年龄';
    const getSpecial = document.createElement('button');
    getSpecial.id = 'getSpecial';
    getSpecial.textContent = 'R18';
    btnGroup.appendChild(getNormal);
    btnGroup.appendChild(getSpecial);
    // 4. 查询输入区
    const queryWrap = document.createElement('div');
    queryWrap.className = 'query-wrap';
    const queryInput = document.createElement('input');
    queryInput.type = 'text';
    queryInput.id = 'queryInput';
    queryInput.placeholder = '输入 Pixiv 作品ID或链接喵';
    const queryBtn = document.createElement('button');
    queryBtn.id = 'queryBtn';
    queryBtn.textContent = '查询';
    queryWrap.appendChild(queryInput);
    queryWrap.appendChild(queryBtn);
    // 5. 查询状态提示
    const queryStatus = document.createElement('div');
    queryStatus.id = 'queryStatus';
    // 6. 信息面板挂载点
    const infoPanelMount = document.createElement('div');
    infoPanelMount.id = 'infoPanelMount';
    // 7. 全屏遮罩
    const mask = document.createElement('div');
    mask.id = 'mask';
    const fullImg = document.createElement('img');
    fullImg.id = 'fullImg';
    fullImg.alt = '全屏查看';
    mask.appendChild(fullImg);
    // 按顺序插入到 body
    document.body.appendChild(imgBox);
    document.body.appendChild(pageControl);
    document.body.appendChild(btnGroup);
    document.body.appendChild(queryWrap);
    document.body.appendChild(queryStatus);
    document.body.appendChild(infoPanelMount);
    document.body.appendChild(mask);

    // 页码原位编辑跳转逻辑
    pageIndicator.addEventListener('click', function (e) {
        // 无作品、单页、不可预览格式时不触发
        if (!currentIllustId || totalPages <= 1 || !PREVIEWABLE_FORMATS.includes(currentExt)) return;
        // 已处于编辑状态不重复创建
        if (pageIndicator.querySelector('input')) return;

        const currentPage = currentPageIndex + 1;
        const maxPage = totalPages;
        const originalText = pageIndicator.textContent;

        pageIndicator.innerHTML = '';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = String(maxPage);
        input.value = String(currentPage);
        // 样式适配深色主题
        input.style.cssText = `
            width: 30px;
            text-align: center;
            background: transparent;
            border: 1px solid #444;
            border-radius: 4px;
            color: #eee;
            font-size: inherit;
            font-family: inherit;
            padding: 2px 4px;
            outline: none;
            -moz-appearance: textfield;
        `;
        // 隐藏Chrome/Edge数字增减箭头
        const styleHideSpin = document.createElement('style');
        styleHideSpin.textContent = `
            #pageIndicator input::-webkit-outer-spin-button,
            #pageIndicator input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
        `;
        document.head.appendChild(styleHideSpin);

        pageIndicator.appendChild(document.createTextNode('<'));
        pageIndicator.appendChild(input);
        pageIndicator.appendChild(document.createTextNode(` / ${maxPage}页>`));

        // 自动聚焦并选中文字
        input.focus();
        input.select();

        // 确认跳转
        function confirmJump() {
            const targetVal = parseInt(input.value);
            if (isNaN(targetVal) || targetVal < 1 || targetVal > maxPage) {
                // 输入非法，恢复原文
                pageIndicator.textContent = originalText;
                return;
            }
            const delta = targetVal - 1 - currentPageIndex;
            if (delta !== 0) {
                changePage(delta);
            } else {
                pageIndicator.textContent = originalText;
            }
        }

        // 回车确认
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmJump();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                pageIndicator.textContent = originalText;
            }
        });

        // 失焦自动确认
        input.addEventListener('blur', confirmJump);
        e.stopPropagation();
    });
})();