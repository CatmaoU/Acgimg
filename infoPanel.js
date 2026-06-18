// UTC+8北京时间换算
function formatBeijingTime(isoStr) {
    if (!isoStr) return '无发布时间';
    const date = new Date(isoStr);
    // 手动计算东八区时间，避免本地时区影响
    const utcTimestamp = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
    const beijingDate = new Date(utcTimestamp + 8 * 3600 * 1000);
    
    const year = beijingDate.getUTCFullYear();
    const month = beijingDate.getUTCMonth() + 1;
    const day = beijingDate.getUTCDate();
    const hours = beijingDate.getUTCHours();
    const minutes = String(beijingDate.getUTCMinutes()).padStart(2, '0');
    const period = hours < 12 ? '上午' : '下午';
    const showHour = hours % 12 || 12;
    return `${year}年${month}月${day}日${period}${showHour}:${minutes} (UTC+8-北京)`;
}

// 初始化作品信息面板：生成完整DOM结构并挂载到页面
function initInfoPanel(mountSelector) {
    // 面板容器
    const panel = document.createElement('div');
    panel.className = 'info-panel';
    panel.id = 'infoPanel';
    panel.style.display = 'none';
    // 面板标题
    const panelTitle = document.createElement('h3');
    panelTitle.textContent = '作品详情';
    panel.appendChild(panelTitle);

    // 通用行创建函数
    function createInfoRow(labelText, valueId) {
        const row = document.createElement('div');
        row.className = 'info-row';
        const label = document.createElement('span');
        label.className = 'info-label';
        label.textContent = labelText;
        const value = document.createElement('span');
        value.id = valueId;
        row.appendChild(label);
        row.appendChild(value);
        panel.appendChild(row);
        return value;
    }

    // 逐行创建信息项
    const valTitle = createInfoRow('作品标题：', 'val-title');
    const valId = createInfoRow('图片ID：', 'val-id');
    const valIllustId = createInfoRow('Pixiv：', 'val-illust-id');
    const valSize = createInfoRow('尺寸：', 'val-size');
    const valType = createInfoRow('作品类型：', 'val-type');
    const valAi = createInfoRow('是否AI生成：', 'val-ai');
    const valXrestrict = createInfoRow('限制分级：', 'val-xrestrict');
    const valTime = createInfoRow('发布时间：', 'val-time');
    const valUsername = createInfoRow('作者昵称：', 'val-username');
    const valUid = createInfoRow('作者Pixiv ID：', 'val-uid');
    const valStats = createInfoRow('收藏/浏览/评论：', 'val-stats');

    // 标签行（特殊结构）
    const tagRow = document.createElement('div');
    tagRow.className = 'info-row';
    const tagLabel = document.createElement('span');
    tagLabel.className = 'info-label';
    tagLabel.textContent = '作品标签：';
    const tagWrap = document.createElement('div');
    tagWrap.className = 'tag-wrap';
    tagWrap.id = 'tagWrap';
    tagRow.appendChild(tagLabel);
    tagRow.appendChild(tagWrap);
    panel.appendChild(tagRow);

    // 挂载到页面指定位置
    const mountNode = document.querySelector(mountSelector);
    if (mountNode) {
        mountNode.appendChild(panel);
    }

    // 返回面板元素和所有值元素引用
    return {
        panel,
        valTitle,
        valId,
        valIllustId,
        valSize,
        valType,
        valAi,
        valXrestrict,
        valTime,
        valUsername,
        valUid,
        valStats,
        tagWrap
    };
}

// 填充作品信息面板数据
function fillInfo(d, tagList, elements) {
    // 基础图片信息
    elements.valTitle.textContent = d.title ?? '无标题';
    elements.valId.textContent = d.id ?? '无';
    elements.valIllustId.textContent = d.illust_id ?? '无';
    const w = d.width ?? '未知';
    const h = d.height ?? '未知';
    elements.valSize.textContent = `${w} × ${h}`;

    // 作品类型
    let typeText = '未知';
    const typeVal = String(d.illust_type).toLowerCase();
    if (typeVal === '0' || typeVal === 'illust') typeText = '插画';
    if (typeVal === '1' || typeVal === 'manga') typeText = '漫画';
    if (typeVal === '2' || typeVal === 'ugoira') typeText = '动图';
    elements.valType.textContent = typeText;

    // AI标记
    const aiRaw = d.ai_type;
    const aiVal = Number(aiRaw);
    const aiResult = aiVal === 2 ? '是' : '否';
    console.log('ai_type 原始值:', aiRaw, ' | 转换后数值:', aiVal, ' | 显示结果:', aiResult);
    elements.valAi.textContent = aiResult;

    // 分级限制
    let xText = '全年龄';
    if (d.x_restrict === 1) xText = 'R-18';
    if (d.x_restrict === 2) xText = 'R-18G';
    elements.valXrestrict.textContent = xText;

    // 发布时间（北京时间）
    elements.valTime.textContent = formatBeijingTime(d.created_at_pixiv);

    // 作者信息
    const user = d.user || {};
    elements.valUsername.textContent = user.name ?? '匿名作者';
    elements.valUid.textContent = user.id ?? '无';

    // 收藏/浏览/评论统计
    const bm = d.bookmark_count ?? 0;
    const view = d.view_count ?? 0;
    const cm = d.comment_count ?? 0;
    elements.valStats.textContent = `收藏${bm} / 浏览${view} / 评论${cm}`;

    // 渲染标签
    elements.tagWrap.innerHTML = '';
    const tags = Array.isArray(tagList) ? tagList : [];
    tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag-item';
        span.innerText = tag;
        elements.tagWrap.appendChild(span);
    });
}