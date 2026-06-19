const img = document.getElementById('randomImg');
const imgBox = document.getElementById('imgBox');
const loadingTip = document.getElementById('loadingTip');
const normalBtn = document.getElementById('getNormal');
const specialBtn = document.getElementById('getSpecial');
const queryInput = document.getElementById('queryInput');
const queryBtn = document.getElementById('queryBtn');
const queryStatus = document.getElementById('queryStatus');
const mask = document.getElementById('mask');
const fullImg = document.getElementById('fullImg');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageIndicator = document.getElementById('pageIndicator');
const infoPanelInstance = initInfoPanel('#infoPanelMount');
const infoPanel = infoPanelInstance.panel;
const infoElements = infoPanelInstance;
const proxyBase = getProxyBase();
const proxyNormal = `${proxyBase}?type=normal`;
const proxyR18 = `${proxyBase}?type=r18`;
let retryCount = 0;
const MAX_RETRY = 2;
let currentImgUrl = '';
let currentImgBase = 'https://i.mukyu.ru';
let currentIllustId = '';
let currentPageIndex = 0;
let currentExt = 'png';
let totalPages = 0;
let isLastPageConfirmed = false;
let imgFallbacked = false;
let queryDebounceTimer = null;
let sniffAbortFlag = false;
let isSniffingDone = true; // 新增：标记页数嗅探是否完成
const PREVIEWABLE_FORMATS = ['png', 'jpg', 'gif', 'webp'];
const MAX_SNIFF_PAGES = 150;
const FALLBACK_IMG_BASE = 'https://pixiv.re';
// 计算约束下的显示尺寸
function calcFitSize(originalW, originalH, maxW, maxH) {
    const ratioW = maxW / originalW;
    const ratioH = maxH / originalH;
    const scale = Math.min(ratioW, ratioH);
    return {
        width: Math.round(originalW * scale),
        height: Math.round(originalH * scale)
    };
}
// 更新容器尺寸
function updateImgBoxSize(w, h) {
    if (!w || !h || isNaN(w) || isNaN(h)) return;
    const maxW = Math.min(imgBox.parentElement.clientWidth, 900);
    const maxH = Math.min(window.innerHeight * 0.7, 800);
    const { width, height } = calcFitSize(w, h, maxW, maxH);
    imgBox.style.width = `${width}px`;
    imgBox.style.height = `${height}px`;
    imgBox.style.aspectRatio = 'auto';
}
function resetViewerState() {
    sniffAbortFlag = true;
    isSniffingDone = true; // 重置状态，默认嗅探完成
    infoPanel.style.display = 'none';
    infoElements.tagWrap.innerHTML = '';
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    pageIndicator.style.display = 'none';
    currentIllustId = '';
    currentPageIndex = 0;
    currentExt = 'png';
    totalPages = 0;
    isLastPageConfirmed = false;
    imgFallbacked = false;
    nextBtn.classList.remove('btn-disabled');
}
function setQueryStatus(message, isError = false) {
    queryStatus.textContent = message;
    queryStatus.style.color = isError ? '#f56c6c' : '#bbb';
}
async function loadImage(api) {
    currentImgBase = 'https://i.mukyu.ru';
    retryCount = 0;
    normalBtn.disabled = true;
    specialBtn.disabled = true;
    loadingTip.textContent = '加载中喵..';
    loadingTip.style.display = 'block';
    imgBox.classList.remove('loaded');
    
    // 清空旧图
    img.src = '';
    currentImgUrl = '';
    
    resetViewerState();
    setQueryStatus('');
    await fetchApi(api);
}
function preloadMultiPages() {
    if (totalPages <= 1 || !currentIllustId || !PREVIEWABLE_FORMATS.includes(currentExt)) return;
    for (let i = 1; i < totalPages; i++) {
        const preImg = new Image();
        preImg.src = `${currentImgBase}/${currentIllustId}-${i + 1}.${currentExt}`;
    }
}
function checkImageExists(url) {
    return new Promise((resolve) => {
        const testImg = new Image();
        testImg.onload = () => resolve(true);
        testImg.onerror = () => resolve(false);
        testImg.src = url;
    });
}
async function sniffTotalPages(pid, ext) {
    sniffAbortFlag = false;
    isSniffingDone = false; // 开始嗅探，标记为未完成
    let page = 2;
    while (page <= MAX_SNIFF_PAGES) {
        if (sniffAbortFlag) {
            isSniffingDone = true;
            return;
        }
        const testUrl = `${currentImgBase}/${pid}-${page}.${ext}`;
        const exists = await checkImageExists(testUrl);
        if (sniffAbortFlag) {
            isSniffingDone = true;
            return;
        }
        if (exists) {
            totalPages = page;
            updatePageIndicator();
            refreshPageButtons();
            page++;
        } else {
            isLastPageConfirmed = true;
            refreshPageButtons();
            isSniffingDone = true; // 嗅探完成
            return;
        }
    }
    isLastPageConfirmed = true;
    refreshPageButtons();
    isSniffingDone = true; // 嗅探完成
}
function refreshPageButtons() {
    prevBtn.disabled = currentPageIndex === 0;
    const isAtLastPage = currentPageIndex + 1 >= totalPages;
    if (isAtLastPage && isLastPageConfirmed) {
        nextBtn.classList.add('btn-disabled');
    } else {
        nextBtn.classList.remove('btn-disabled');
    }
}
async function fetchApi(api) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(api, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("http error");
        const json = await res.json();
        if (!json?.data?.urls?.proxy) throw new Error("api error");
        const dataRoot = json.data;
        const imgInfo = dataRoot.image;
        // 设置容器尺寸
        const realW = Number(imgInfo.width) || 16;
        const realH = Number(imgInfo.height) || 9;
        updateImgBoxSize(realW, realH);
        const ext = imgInfo.ext || 'png';
        let imgUrl = `${currentImgBase}/${imgInfo.illust_id}.${ext}`;
        fillInfo(imgInfo, dataRoot.tags, infoElements);
        infoPanel.style.display = 'block';
        
        const pageIndex = Number(imgInfo.page_index) || 0;
        const isMultiPage = pageIndex > 0 && PREVIEWABLE_FORMATS.includes(ext);
        if (isMultiPage) {
            currentIllustId = imgInfo.illust_id || '';
            currentExt = ext;
            totalPages = pageIndex + 1;
            currentPageIndex = 0;
            imgUrl = `${currentImgBase}/${currentIllustId}-1.${currentExt}`;
            updatePageIndicator();
            pageIndicator.style.display = 'block';
            prevBtn.style.display = 'block';
            nextBtn.style.display = 'block';
            refreshPageButtons();
        }
        currentImgUrl = imgUrl;
        img.onload = null;
        img.onerror = null;
        
        img.onload = () => {
            if (img.src !== currentImgUrl) return;
            // 修正尺寸
            updateImgBoxSize(img.naturalWidth, img.naturalHeight);
            
            imgBox.classList.add('loaded');
            normalBtn.disabled = false;
            specialBtn.disabled = false;
            preloadMultiPages();
            if (isMultiPage) {
                loadingTip.textContent = '还有图片未加载完成喵~';
                loadingTip.style.display = 'block';
                sniffTotalPages(currentIllustId, currentExt).then(() => {
                    if (loadingTip.textContent === '还有图片未加载完成喵~') {
                        loadingTip.style.display = 'none';
                    }
                });
            } else {
                loadingTip.style.display = 'none';
            }
        }
        img.onerror = () => {
            if (img.src !== currentImgUrl) return;
            if (!imgFallbacked && currentImgBase !== FALLBACK_IMG_BASE) {
                imgFallbacked = true;
                currentImgBase = FALLBACK_IMG_BASE;
                if (isMultiPage) {
                    currentImgUrl = `${currentImgBase}/${currentIllustId}-1.${currentExt}`;
                } else {
                    currentImgUrl = `${currentImgBase}/${imgInfo.illust_id}.${ext}`;
                }
                img.src = currentImgUrl;
                return;
            }
            loadingTip.textContent = '图片加载失败喵';
            normalBtn.disabled = false;
            specialBtn.disabled = false;
        }
        // 原生边加载缓存
        img.src = imgUrl;
    } catch (err) {
        const isTimeout = err.name === 'AbortError';
        if (retryCount < MAX_RETRY && !isTimeout) {
            retryCount++;
            loadingTip.textContent = `重试中喵(${retryCount}/${MAX_RETRY})`;
            setTimeout(() => fetchApi(api), 600);
        } else {
            loadingTip.textContent = isTimeout ? '连接超时喵' : '加载失败喵';
            normalBtn.disabled = false;
            specialBtn.disabled = false;
        }
    }
}
function updatePageIndicator() {
    pageIndicator.textContent = `<${currentPageIndex + 1}/${totalPages}页>`;
}
function changePage(delta) {
    if (!PREVIEWABLE_FORMATS.includes(currentExt)) return;
    if (!currentIllustId) return;
    const newPage = currentPageIndex + delta;
    if (newPage < 0) return;
    if (delta > 0 && isLastPageConfirmed && currentPageIndex + 1 >= totalPages) {
        loadingTip.textContent = '到底了喵！';
        loadingTip.style.display = 'block';
        setTimeout(() => {
            loadingTip.style.display = 'none';
        }, 1500);
        return;
    }
    const newImgUrl = `${currentImgBase}/${currentIllustId}-${newPage + 1}.${currentExt}`;
    const oldPageIndex = currentPageIndex;
    const oldImgUrl = currentImgUrl;
    loadingTip.textContent = '加载中喵..';
    loadingTip.style.display = 'block';
    
    // 翻页清空旧图
    img.src = '';
    
    img.onload = null;
    img.onerror = null;
    
    img.onload = () => {
        if (img.src !== newImgUrl) return;
        currentImgUrl = newImgUrl;
        currentPageIndex = newPage;
        if (newPage + 1 > totalPages) {
            totalPages = newPage + 1;
        }
        updatePageIndicator();
        refreshPageButtons();
        // 每页自适应尺寸
        updateImgBoxSize(img.naturalWidth, img.naturalHeight);
        // 修复：嗅探未完成时恢复显示未完成提示，不直接隐藏
        if (!isSniffingDone) {
            loadingTip.textContent = '还有图片未加载完成喵~';
            loadingTip.style.display = 'block';
        } else {
            loadingTip.style.display = 'none';
        }
    }
    img.onerror = () => {
        if (img.src !== newImgUrl) return;
        if (delta > 0) {
            isLastPageConfirmed = true;
            refreshPageButtons();
            currentPageIndex = oldPageIndex;
            updatePageIndicator();
            img.src = oldImgUrl;
            loadingTip.textContent = '到底了喵！';
            setTimeout(() => {
                loadingTip.style.display = 'none';
            }, 1500);
        }
    }
    img.src = newImgUrl;
}
prevBtn.addEventListener('click', () => changePage(-1));
nextBtn.addEventListener('click', () => changePage(1));
// 触摸滑动切换
let touchStartX = 0;
let touchEndX = 0;
const SWIPE_THRESHOLD = 50;
img.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });
img.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) < SWIPE_THRESHOLD) return;
    changePage(diff > 0 ? -1 : 1);
}, { passive: true });
// 全屏查看
img.addEventListener('click', () => {
    if (window.innerWidth >= 768 && PREVIEWABLE_FORMATS.includes(currentExt)) {
        fullImg.src = img.src;
        mask.style.display = 'flex';
    }
});
img.addEventListener('dblclick', () => {
    if (PREVIEWABLE_FORMATS.includes(currentExt)) {
        fullImg.src = img.src;
        mask.style.display = 'flex';
    }
});
mask.addEventListener('click', () => {
    mask.style.display = 'none';
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mask.style.display === 'flex') {
        mask.style.display = 'none';
    }
});
normalBtn.addEventListener('click', () => loadImage(proxyNormal));
specialBtn.addEventListener('click', () => loadImage(proxyR18));
// 窗口缩放自适应
let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (img.complete && img.naturalWidth) {
            updateImgBoxSize(img.naturalWidth, img.naturalHeight);
        }
    }, 100);
});
window.onload = () => loadImage(proxyNormal);