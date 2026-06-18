// 提取Pixiv作品ID
function extractPixivId(input) {
    const raw = (input || '').trim();
    if (!raw) return '';
    if (/^\d+$/.test(raw)) return raw;

    const artworksMatch = raw.match(/artworks\/(\d+)/i);
    if (artworksMatch) return artworksMatch[1];

    const fallbackMatch = raw.match(/(\d{5,})/);
    return fallbackMatch ? fallbackMatch[1] : '';
}

// 检测zip压缩文件是否存在
function checkZipExists(url) {
    return fetch(url, { method: 'HEAD', mode: 'no-cors' })
        .then(() => true)
        .catch(() => {
            return new Promise((resolve) => {
                const testImg = new Image();
                testImg.onload = () => resolve(false);
                testImg.onerror = () => resolve(true);
                testImg.src = url;
            });
        });
}

// 查询图片
async function loadQueriedImage(rawInput) {
    const pid = extractPixivId(rawInput);
    if (!pid) {
        setQueryStatus('请输入正确的 Pixiv 作品ID或作品链接喵', true);
        return;
    }

    queryBtn.disabled = true;
    normalBtn.disabled = true;
    specialBtn.disabled = true;
    setQueryStatus(`正在加载作品 ${pid} 喵`);

    loadingTip.textContent = '加载中喵';
    loadingTip.style.display = 'block';
    imgBox.classList.remove('loaded');
    img.style.opacity = '0';
    // 先重置状态，再赋值全局变量
    resetViewerState();
    currentImgBase = 'https://pixiv.re';
    currentIllustId = pid;
    
    img.onload = null;
    img.onerror = null;

    // 图片格式
    const imageFormats = ['png', 'jpg', 'gif', 'webp'];
    let formatIndex = 0;

    // 优先尝试带-1后缀的多图格式
    const tryLoadWithSuffix = () => {
        if (formatIndex >= imageFormats.length) {
            // 多图格式全部失败，尝试单图格式
            formatIndex = 0;
            tryLoadNoSuffix();
            return;
        }

        const currentFormat = imageFormats[formatIndex];
        const imgUrl = `${currentImgBase}/${pid}-1.${currentFormat}`;
        currentImgUrl = imgUrl;

        img.onload = () => {
            if (img.src !== currentImgUrl) return;
            currentExt = currentFormat;
            currentPageIndex = 0;
            // 保底显示1页，后续嗅探/翻页动态增加
            totalPages = 1;

            img.style.opacity = '1';
            imgBox.classList.add('loaded');
            loadingTip.style.display = 'none';
            queryBtn.disabled = false;
            normalBtn.disabled = false;
            specialBtn.disabled = false;

            // 立刻显示页码和翻页按钮，首张加载完就能翻
            updatePageIndicator();
            pageIndicator.style.display = 'block';
            prevBtn.style.display = 'block';
            nextBtn.style.display = 'block';
            refreshPageButtons();

            setQueryStatus(`已加载 ${pid}，正在统计总页数喵...（${currentFormat.toUpperCase()}）`);

            // 启动后台异步页数嗅探
            sniffTotalPages(pid, currentFormat).then(() => {
                if (!sniffAbortFlag) {
                    setQueryStatus(`已加载 ${pid}，共 ${totalPages} 张喵~（${currentFormat.toUpperCase()}）`);
                }
            });
        };

        img.onerror = () => {
            if (img.src !== currentImgUrl) return;
            formatIndex++;
            tryLoadWithSuffix();
        };

        img.src = imgUrl;
    };

    // 尝试无后缀的单图格式
    const tryLoadNoSuffix = () => {
        if (formatIndex >= imageFormats.length) {
            // 所有图片格式失败，最后尝试zip动图压缩包
            tryLoadZipFormat();
            return;
        }

        const currentFormat = imageFormats[formatIndex];
        const imgUrl = `${currentImgBase}/${pid}.${currentFormat}`;
        currentImgUrl = imgUrl;

        img.onload = () => {
            if (img.src !== currentImgUrl) return;
            currentExt = currentFormat;
            totalPages = 1;
            isLastPageConfirmed = true;

            img.style.opacity = '1';
            imgBox.classList.add('loaded');
            loadingTip.style.display = 'none';
            queryBtn.disabled = false;
            normalBtn.disabled = false;
            specialBtn.disabled = false;
            setQueryStatus(`已加载 ${pid}，共 1 张喵~（${currentFormat.toUpperCase()}）`);
        };

        img.onerror = () => {
            if (img.src !== currentImgUrl) return;
            formatIndex++;
            tryLoadNoSuffix();
        };

        img.src = imgUrl;
    };

    // 尝试Ugoira动图zip压缩包
    const tryLoadZipFormat = () => {
        const zipUrl = `${currentImgBase}/${pid}.zip`;
        checkZipExists(zipUrl).then(exists => {
            if (exists) {
                currentImgUrl = zipUrl;
                currentExt = 'zip';
                totalPages = 1;
                isLastPageConfirmed = true;

                img.src = zipUrl;
                img.style.opacity = '0.2';
                imgBox.classList.add('loaded');
                loadingTip.textContent = '动图压缩包';
                queryBtn.disabled = false;
                normalBtn.disabled = false;
                specialBtn.disabled = false;
                setQueryStatus(`作品 ${pid} 为 Ugoira 动图压缩包（ZIP），可右键图片另存为下载`);
            } else {
                // 所有格式均失败
                loadingTip.textContent = '加载失败喵';
                queryBtn.disabled = false;
                normalBtn.disabled = false;
                specialBtn.disabled = false;
                setQueryStatus(`作品 ${pid} 所有格式均加载失败，请检查ID或网络`, true);
            }
        });
    };

    tryLoadWithSuffix();
}

// 查询按钮点击（带防抖）
queryBtn.addEventListener('click', () => {
    clearTimeout(queryDebounceTimer);
    queryDebounceTimer = setTimeout(() => {
        loadQueriedImage(queryInput.value);
    }, 300);
});

// 回车触发查询（带防抖）
queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        clearTimeout(queryDebounceTimer);
        queryDebounceTimer = setTimeout(() => {
            loadQueriedImage(queryInput.value);
        }, 300);
    }
});