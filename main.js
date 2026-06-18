const img = document.getElementById('randomImg');
const imgBox = document.getElementById('imgBox');
const loadingTip = document.getElementById('loadingTip');
const normalBtn = document.getElementById('getNormal');
const specialBtn = document.getElementById('getSpecial');
const queryInput = document.getElementById('queryInput');
const queryBtn = document.getElementById('queryBtn');
const queryStatus = document.getElementById('queryStatus');
// 全屏元素
const mask = document.getElementById('mask');
const fullImg = document.getElementById('fullImg');
// 多页切换元素
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageIndicator = document.getElementById('pageIndicator');

// 初始化作品信息面板，获取所有元素引用
const infoPanelInstance = initInfoPanel('#infoPanelMount');
const infoPanel = infoPanelInstance.panel;
const infoElements = infoPanelInstance;

const proxyBase = getProxyBase();
const proxyNormal = `${proxyBase}?type=normal`;
const proxyR18 = `${proxyBase}?type=r18`;

let retryCount = 0;
const MAX_RETRY = 2;
// 记录当前加载的图片地址
let currentImgUrl = '';
// 当前图片基础域名
let currentImgBase = 'https://i.mukyu.ru';
// 多页切换状态
let currentIllustId = '';
let currentPageIndex = 0;
// 当前作品图片格式（png/jpg/gif/webp/zip）
let currentExt = 'png';
// 总页数，可动态扩容
let totalPages = 0;
// 标记是否已确认没有更多页（总页数为最终值）
let isLastPageConfirmed = false;
// 图片加载失败执行备用域名（一次）
let imgFallbacked = false;
// 查询防抖计时器
let queryDebounceTimer = null;
// 页数嗅探中断标记
let sniffAbortFlag = false;
// 可直接预览的图片格式
const PREVIEWABLE_FORMATS = ['png', 'jpg', 'gif', 'webp'];
// 页数嗅探最大上限
const MAX_SNIFF_PAGES = 150;
// 备用代理域名
const FALLBACK_IMG_BASE = 'https://pixiv.re';

function resetViewerState() {
    // 中断上一次的页数嗅探
    sniffAbortFlag = true;
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
    img.style.opacity = '1';
}

function setQueryStatus(message, isError = false) {
    queryStatus.textContent = message;
    queryStatus.style.color = isError ? '#f56c6c' : '#bbb';
}

async function loadImage(api) {
    // 切换为随机图默认域名
    currentImgBase = 'https://i.mukyu.ru';
    retryCount = 0;
    normalBtn.disabled = true;
    specialBtn.disabled = true;
    loadingTip.textContent = '加载中喵';
    loadingTip.style.display = 'block';
    imgBox.classList.remove('loaded');
    // 清空旧图
    img.style.opacity = '0';
    resetViewerState();
    setQueryStatus('');

    await fetchApi(api);
}

// 多图后台预加载缓存函数
function preloadMultiPages() {
    // 仅多页模式且为可预览格式时执行
    if (totalPages <= 1 || !currentIllustId || !PREVIEWABLE_FORMATS.includes(currentExt)) return;
    // 从第2张开始预加载，第1张已经加载完成
    for (let i = 1; i < totalPages; i++) {
        const preImg = new Image();
        preImg.src = `${currentImgBase}/${currentIllustId}-${i + 1}.${currentExt}`;
    }
}

// 检测单张图片是否存在
function checkImageExists(url) {
    return new Promise((resolve) => {
        const testImg = new Image();
        testImg.onload = () => resolve(true);
        testImg.onerror = () => resolve(false);
        testImg.src = url;
    });
}

// 后台异步嗅探总页数
async function sniffTotalPages(pid, ext) {
    sniffAbortFlag = false;
    let page = 2; // 从第2页开始探测

    while (page <= MAX_SNIFF_PAGES) {
        if (sniffAbortFlag) return;

        const testUrl = `${currentImgBase}/${pid}-${page}.${ext}`;
        const exists = await checkImageExists(testUrl);

        if (sniffAbortFlag) return;

        if (exists) {
            // 加载成功，总页数+1并实时更新UI
            totalPages = page;
            updatePageIndicator();
            // 同步更新下一页按钮状态
            refreshPageButtons();
            page++;
        } else {
            // 探测结束，标记已确认没有更多页
            isLastPageConfirmed = true;
            refreshPageButtons();
            return;
        }
    }

    // 达到最大探测页数，标记已确认没有更多页
    isLastPageConfirmed = true;
    refreshPageButtons();
}

// 同步刷新翻页按钮状态
function refreshPageButtons() {
    prevBtn.disabled = currentPageIndex === 0;
    // 只有当前页就是最后一页，且已确认无更多页时，才置灰下一页按钮
    const isAtLastPage = currentPageIndex + 1 >= totalPages;
    if (isAtLastPage && isLastPageConfirmed) {
        nextBtn.classList.add('btn-disabled');
    } else {
        nextBtn.classList.remove('btn-disabled');
    }
}

async function fetchApi(api) {
    try {
        // 10秒超时，避免连不上代理超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(api, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error("http error");
        const json = await res.json();
        // 校验结构
        if (!json?.data?.urls?.proxy) throw new Error("api error");

        const dataRoot = json.data;
        const imgInfo = dataRoot.image;
        // 兼容接口返回的所有格式
        const ext = imgInfo.ext || 'png';
        let imgUrl = `${currentImgBase}/${imgInfo.illust_id}.${ext}`;

        // 调用独立模块的填充函数
        fillInfo(imgInfo, dataRoot.tags, infoElements);
        infoPanel.style.display = 'block';

        // 按page_index字段判断是否为多页作品：大于0为多页
        const pageIndex = Number(imgInfo.page_index) || 0;
        const isMultiPage = pageIndex > 0 && PREVIEWABLE_FORMATS.includes(ext);
        if (isMultiPage) {
            currentIllustId = imgInfo.illust_id || '';
            currentExt = ext;
            totalPages = pageIndex + 1;
            currentPageIndex = 0;
            // 拼接第一页的图片地址
            imgUrl = `${currentImgBase}/${currentIllustId}-1.${currentExt}`;
            // 更新UI
            updatePageIndicator();
            pageIndicator.style.display = 'block';
            prevBtn.style.display = 'block';
            nextBtn.style.display = 'block';
            refreshPageButtons();
        }

        currentImgUrl = imgUrl;

        // 清理上一次的事件回调
        img.onload = null;
        img.onerror = null;

        // 绑定本次加载的事件
        img.onload = () => {
            if (img.src !== currentImgUrl) return;
            img.style.opacity = '1';
            imgBox.classList.add('loaded');
            normalBtn.disabled = false;
            specialBtn.disabled = false;
            // 自动预加载后续所有图片
            preloadMultiPages();
            // 多页作品启动后台页数嗅探并显示提示
            if (isMultiPage) {
                loadingTip.textContent = '还有图片未加载完成喵~';
                loadingTip.style.display = 'block';
                sniffTotalPages(currentIllustId, currentExt).then(() => {
                    // 仅当提示仍为嗅探提示时隐藏，避免覆盖翻页等其他提示
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
            // 随机图默认域名加载失败，切换备用域名重试
            if (!imgFallbacked && currentImgBase !== FALLBACK_IMG_BASE) {
                imgFallbacked = true;
                currentImgBase = FALLBACK_IMG_BASE;
                // 按单图/多图重新尝试备用地址
                if (isMultiPage) {
                    currentImgUrl = `${currentImgBase}/${currentIllustId}-1.${currentExt}`;
                } else {
                    currentImgUrl = `${currentImgBase}/${imgInfo.illust_id}.${ext}`;
                }
                // 使用备用域名重新加载
                img.src = currentImgUrl;
                return;
            }
            // 备用后仍失败，显示加载失败
            loadingTip.textContent = '图片加载失败喵';
            normalBtn.disabled = false;
            specialBtn.disabled = false;
        }

        // 最后再设置地址，保证事件已绑定
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

// 更新页码显示
function updatePageIndicator() {
    pageIndicator.textContent = `<${currentPageIndex + 1}/${totalPages}页>`;
}

// 多页切换
function changePage(delta) {
    if (!PREVIEWABLE_FORMATS.includes(currentExt)) return;
    if (!currentIllustId) return;

    const newPage = currentPageIndex + delta;
    if (newPage < 0) return;

    // 底页验证
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

    loadingTip.textContent = '加载中喵';
    loadingTip.style.display = 'block';
    img.style.opacity = '0';

    img.onload = null;
    img.onerror = null;

    img.onload = () => {
        if (img.src !== newImgUrl) return;
        currentImgUrl = newImgUrl;
        currentPageIndex = newPage;

        // 动态扩容
        if (newPage + 1 > totalPages) {
            totalPages = newPage + 1;
        }

        updatePageIndicator();
        refreshPageButtons();
        img.style.opacity = '1';
        loadingTip.style.display = 'none';
    }

    img.onerror = () => {
        if (img.src !== newImgUrl) return;
        // 向后翻页失败，确认到最后一页
        if (delta > 0) {
            isLastPageConfirmed = true;
            refreshPageButtons();
            // 回退到上一页
            currentPageIndex = oldPageIndex;
            updatePageIndicator();
            img.src = oldImgUrl;
            loadingTip.textContent = '到底了喵！';
            setTimeout(() => {
                loadingTip.style.display = 'none';
            }, 1500);
        }
        img.style.opacity = '1';
    }

    img.src = newImgUrl;
}

// 箭头点击切换
prevBtn.addEventListener('click', () => changePage(-1));
nextBtn.addEventListener('click', () => changePage(1));

// 触摸滑动切换（手机端）
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
    // 右滑=上一页，左滑=下一页
    changePage(diff > 0 ? -1 : 1);
}, { passive: true });

// 电脑端单击，手机端双击
img.addEventListener('click', () => {
    if (window.innerWidth >= 768 && PREVIEWABLE_FORMATS.includes(currentExt)) {
        fullImg.src = img.src;
        mask.style.display = 'flex';
    }
});

// 双击放大图片（手机端）
img.addEventListener('dblclick', () => {
    if (PREVIEWABLE_FORMATS.includes(currentExt)) {
        fullImg.src = img.src;
        mask.style.display = 'flex';
    }
});

// 黑色遮罩关闭全屏
mask.addEventListener('click', () => {
    mask.style.display = 'none';
});

// ESC 键关闭全屏
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mask.style.display === 'flex') {
        mask.style.display = 'none';
    }
});

normalBtn.addEventListener('click', () => loadImage(proxyNormal));
specialBtn.addEventListener('click', () => loadImage(proxyR18));
window.onload = () => loadImage(proxyNormal);