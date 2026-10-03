(function initI18n(root) {
  const kit = root.DownloaderKit = root.DownloaderKit || {};
  const KEY = 'xiaohongshu-dl-language-v1';
  const messages = {
    'zh-CN': {
      appTitle: '小红书下载助手 - 图片视频下载',
      saveMedia: '保存素材',
      openAssistant: '打开下载助手',
      close: '关闭',
      identifying: '识别笔记中…',
      needDetail: '请打开笔记详情',
      image: '图片',
      video: '视频',
      imageOne: '图片',
      videoOne: '视频',
      text: '文字',
      selectAll: '全选',
      countImages: '{count} 张',
      countVideos: '{count} 个',
      noImagesFound: '未找到图片',
      noVideosFound: '未找到视频',
      clickRightToDownload: '点右侧下载',
      mediaItemLabel: '{kind} {index}',
      noText: '暂未识别到文字',
      downloadSelectedImages: '下载选中图片',
      downloadSelectedVideos: '下载选中视频',
      downloadTextTxt: '下载文字 TXT',
      copyText: '复制文字',
      textCopied: '文字已复制',
      copyFailedManual: '复制失败，请手动复制',
      settings: '设置',
      feedback: '反馈',
      copied: '已复制',
      copyEmail: '点击复制反馈邮箱 {email}',
      language: '语言',
      chinese: '简体中文',
      english: 'English',
      languageHint: '弹窗与面板同步。',
      backToDownload: '返回下载',
      faq: '常见问题',
      privacy: '隐私政策',
      disclaimer: '仅供个人学习 · 请遵守小红书使用条款',
      notice: '公告',
      coopTitle: '开发合作',
      noticeEmpty: '暂无新公告',
      noticePinned: '置顶说明',
      noticeRecent: '最近更新',
      noticeIssues: '已知问题',
      noticeRoadmap: '开发计划',
      noticeFeedback: '征集中',
      noticeUpcoming: '即将更新',
      noticePlanned: '计划中',
      ratingTitle: '支持我们',
      ratingText: '欢迎在 {store} 评分。',
      ratingGo: '前往评分',
      ratingLater: '下次再说',
      ratingNever: '不再提示',
      pause: '暂停',
      resume: '继续',
      cancel: '取消',
      preparing: '准备下载',
      downloading: '下载中…',
      downloadingProgress: '下载中 {received} / {total}',
      paused: '已暂停',
      pausedProgress: '已暂停 {received} / {total}',
      done: '已完成',
      imageFallback: '高清不可用，已保存备用图片',
      cancelled: '已取消',
      downloadFailed: '下载失败',
      saveFailed: '保存失败',
      selectContentFirst: '请先选择要保存的内容',
      invalidFilename: '文件名无效',
      readVideoFailed: '读取播放数据失败',
      videoTooLarge: '视频超过 500 MB，暂不支持页面内缓存保存',
      videoStreamFailed: '无法读取视频流',
      videoTooLargeStopped: '视频超过 500 MB，已停止页面内缓存保存',
      videoTooSmall: '视频数据过小',
      resolveFailed: '读取内容失败',
      connectionTimeout: '响应超时，请刷新页面后重试',
      extensionUpdated: '插件已更新，请刷新页面后重试',
      connectionFailed: '连接失败，请刷新页面',
      noContent: '暂无内容',
      updatedAt: '更新：{date}',
      noticeFeedbackItems: '待反馈需求',
      noticeUpcomingItems: '待更新需求',
      noticePlannedItems: '待做需求',
      versionTooLow: '当前版本 v{current} 低于配置要求 v{minimum}，请在扩展管理页更新后再使用。',
      folderSample: '小红书',
      currentNote: '当前小红书笔记',
      noteLabel: '小红书笔记',
      authorPrefix: '作者 · ',
      mediaSummary: '图片 {images} · 视频 {videos} · 文字 {text}',
      textRecognized: '已识别',
      textNone: '无',
      notDetailPage: '未识别到笔记详情页',
      openXhsFirst: '请先打开小红书',
      emptyTitleOnSite: '打开笔记或主页',
      emptyTitleOffSite: '打开小红书',
      emptyLeadOnSite: '打开笔记或主页，点击右下角下载按钮。',
      emptyLeadOffSite: '打开小红书笔记或主页，点击下载按钮。',
      stepOpen: '打开笔记或主页',
      stepEntry: '点击右下角下载按钮',
      stepSave: '勾选内容并下载',
      emptyNote: '支持图片、视频和文字；主页、收藏、点赞支持批量下载。请保存有权使用的内容。',
      openXhs: '打开小红书',
      recognizedNote: '已读取笔记',
      readyNote: '点击下载面板，选择图片、视频或文字。',
      openPanel: '打开下载面板',
      loadFailed: '加载失败',
      errorTitle: '暂时无法读取笔记信息',
      errorHint: '刷新页面后重试。',
      retry: '刷新并重试',
      currentPage: '当前页面：',
      unknownPage: '未知',
      timeout: '识别超时',
      readFail: '读取失败，请刷新',
      panelFail: '打开失败，请刷新',
      refreshFail: '请手动刷新页面',
      helpLinks: '帮助链接',
      downloadSteps: '下载步骤',
      statusInstagram: '小红书下载步骤',
      feedbackSubject: '小红书下载助手反馈',
      selectImagesFirst: '请勾选图片',
      selectVideosFirst: '请勾选视频',
      downloadOk: '已开始下载',
      settingsTitle: '设置',
      download: '下载',
      donate: '赞赏',
      donateTitle: '感谢支持',
      donateIntro: '自愿赞赏，下载免费。',
      donateMethods: '赞赏方式',
      donateWechat: '微信赞赏',
      donateAlipay: '支付宝',
      theme: '主题色',
      themeXiaohongshu: '小红书主题',
      'theme-tokyo-love': '东爱主题',
      'theme-manchester-sea': '海边的曼彻斯特',
      'theme-chinese-odyssey': '大话西游',
      themeSaved: '主题已保存',
      themeSaveFailed: '主题保存失败',
      filename: '文件名',
      filenameRule: '文件名规则',
      customTemplate: '自定义模板',
      presetIndexKind: '默认（序号-类型）',
      presetDefault: '标题 - 作者',
      presetAuthorTitle: '作者 - 标题',
      presetTitle: '仅标题',
      presetTitleId: '标题 - 笔记ID',
      presetDetailed: '标题 - 作者 - 类型',
      presetCustom: '自定义…',
      chipTitle: '标题',
      chipAuthor: '作者',
      chipId: '笔记ID',
      chipIndex: '序号',
      chipKind: '类型',
      chipDate: '日期',
      preview: '预览：{name}',
      previewEmpty: '预览不可用',
      invalidTemplate: '文件名模板无效',
      invalidTemplateChars: '不能包含路径或非法字符',
      invalidTemplateFormat: '字段格式：{title}',
      unknownToken: '未知字段：{token}',
      sampleTitle: '示例笔记标题',
      sampleAuthor: '示例作者',
      saved: '已保存',
      viewDownloads: '查看下载记录',
      cannotOpenDownloads: '无法打开下载页',
      restored: '已恢复默认',
      restoreFailed: '恢复失败',
      resetDefault: '恢复默认',
      settingsHint: '已入队任务不受影响',
      modeLabel: '下载模式',
      currentContent: '当前笔记',
      creator: '作品列表',
      refreshPosts: '刷新',
      downloadSelectedCovers: '下载选中作品',
      creatorDownloadHint: '图片下载全图，视频下载视频。',
      creatorCollectHint: '收藏 · 图片下载全图，视频下载视频。',
      creatorLikesHint: '点赞 · 图片下载全图，视频下载视频。',
      creatorGoProfile: '打开主页，勾选作品下载。',
      openCreatorProfile: '打开主页',
      creatorEmptyTitle: '暂无作品',
      creatorEmptyDetail: '向下滚动加载，再刷新列表。',
      scanReady: '准备就绪',
      scanReadyCount: '已读取 {count} 条',
      creatorStats: '共 {total} 个 · 已下载 {downloaded} 个',
      listNoteCount: '{count} 个作品',
      selectAllShort: '全选',
      selectNewShort: '仅未下载',
      clearShort: '清空',
      selectedCount: '已选 {count} 个',
      countNotes: '{count} 条',
      coverUnavailable: '无封面',
      selectCoversFirst: '请勾选作品',
      statusDownloaded: '已下载',
      statusNew: '未下载',
      needSupportedPage: '请打开笔记或主页',
      recognizedProfile: '已读取主页',
      readyProfile: '勾选作品，下载图片或视频。',
      notSupportedPage: '当前页面不支持下载'
    },
    en: {
      appTitle: 'RedNote Downloader - Xiaohongshu Video & Image Downloader',
      saveMedia: 'Save media',
      openAssistant: 'Open downloader',
      close: 'Close',
      identifying: 'Reading note…',
      needDetail: 'Open a note',
      image: 'Images',
      video: 'Videos',
      imageOne: 'Image',
      videoOne: 'Video',
      text: 'Text',
      selectAll: 'Select all',
      countImages: '{count} images',
      countVideos: '{count} videos',
      noImagesFound: 'No images found',
      noVideosFound: 'No videos found',
      clickRightToDownload: 'Download on the right',
      mediaItemLabel: '{kind} {index}',
      noText: 'No text found',
      downloadSelectedImages: 'Download selected images',
      downloadSelectedVideos: 'Download selected videos',
      downloadTextTxt: 'Download text TXT',
      copyText: 'Copy text',
      textCopied: 'Text copied',
      copyFailedManual: 'Copy failed. Copy manually.',
      settings: 'Settings',
      feedback: 'Feedback',
      copied: 'Copied',
      copyEmail: 'Click to copy feedback email {email}',
      language: 'Language',
      chinese: '简体中文',
      english: 'English',
      languageHint: 'Synced across popup and panel.',
      backToDownload: 'Back to download',
      faq: 'FAQ',
      privacy: 'Privacy',
      disclaimer: 'For personal learning only. Follow Xiaohongshu’s terms.',
      notice: 'Notice',
      coopTitle: 'Collaboration',
      noticeEmpty: 'No notices',
      noticePinned: 'Pinned',
      noticeRecent: 'Recent updates',
      noticeIssues: 'Known issues',
      noticeRoadmap: 'Roadmap',
      noticeFeedback: 'Feedback',
      noticeUpcoming: 'Coming soon',
      noticePlanned: 'Planned',
      ratingTitle: 'Support us',
      ratingText: 'Rate us on {store}.',
      ratingGo: 'Rate us',
      ratingLater: 'Maybe later',
      ratingNever: 'Don’t show again',
      pause: 'Pause',
      resume: 'Resume',
      cancel: 'Cancel',
      preparing: 'Preparing',
      downloading: 'Downloading…',
      downloadingProgress: 'Downloading {received} / {total}',
      paused: 'Paused',
      pausedProgress: 'Paused {received} / {total}',
      done: 'Done',
      imageFallback: 'Saved fallback image; higher quality unavailable',
      cancelled: 'Cancelled',
      downloadFailed: 'Download failed',
      saveFailed: 'Save failed',
      selectContentFirst: 'Select items to save first',
      invalidFilename: 'Invalid filename',
      readVideoFailed: 'Couldn’t read video data',
      videoTooLarge: 'Videos over 500 MB aren’t supported for in-page save',
      videoStreamFailed: 'Couldn’t read video stream',
      videoTooLargeStopped: 'Stopped: video exceeds 500 MB',
      videoTooSmall: 'Video data is too small',
      resolveFailed: 'Couldn’t read note content',
      connectionTimeout: 'Timed out. Refresh the page and try again',
      extensionUpdated: 'Extension updated. Refresh the page and try again',
      connectionFailed: 'Connection failed. Refresh the page',
      noContent: 'No content',
      updatedAt: 'Updated: {date}',
      noticeFeedbackItems: 'Feedback',
      noticeUpcomingItems: 'Coming soon',
      noticePlannedItems: 'Planned',
      versionTooLow: 'Version v{current} is below required v{minimum}. Update the extension and try again.',
      folderSample: 'Xiaohongshu',
      currentNote: 'Current Xiaohongshu note',
      noteLabel: 'Xiaohongshu note',
      authorPrefix: 'Author · ',
      mediaSummary: 'Images {images} · Videos {videos} · Text {text}',
      textRecognized: 'Found',
      textNone: 'None',
      notDetailPage: 'Note detail page not recognized',
      openXhsFirst: 'Open Xiaohongshu first',
      emptyTitleOnSite: 'Open a note or profile',
      emptyTitleOffSite: 'Open Xiaohongshu',
      emptyLeadOnSite: 'Open a note or profile, then click the download button.',
      emptyLeadOffSite: 'Open Xiaohongshu, then a note or profile.',
      stepOpen: 'Open a note or profile',
      stepEntry: 'Click the download button',
      stepSave: 'Select and download',
      emptyNote: 'Download images, videos and text. Batch download from profiles, collections and likes. Save content you have permission to use.',
      openXhs: 'Open Xiaohongshu',
      recognizedNote: 'Note ready',
      readyNote: 'Open the panel to select images, videos or text.',
      openPanel: 'Open download panel',
      loadFailed: 'Couldn’t load',
      errorTitle: 'Can’t read this note yet',
      errorHint: 'Refresh and retry.',
      retry: 'Refresh and retry',
      currentPage: 'Current page: ',
      unknownPage: 'Unknown',
      timeout: 'Recognition timed out',
      readFail: 'Couldn’t read. Refresh the page.',
      panelFail: 'Couldn’t open. Refresh the page.',
      refreshFail: 'Refresh the page manually.',
      helpLinks: 'Help links',
      downloadSteps: 'Download steps',
      statusInstagram: 'Xiaohongshu download steps',
      feedbackSubject: 'Xiaohongshu Downloader feedback',
      selectImagesFirst: 'Select images',
      selectVideosFirst: 'Select videos',
      downloadOk: 'Download started',
      settingsTitle: 'Settings',
      download: 'Download',
      donate: 'Support',
      donateTitle: 'Thanks for your support',
      donateIntro: 'Tips are optional. Downloads are free.',
      donateMethods: 'Payment method',
      donateWechat: 'WeChat',
      donateAlipay: 'Alipay',
      theme: 'Theme',
      themeXiaohongshu: 'Xiaohongshu theme',
      'theme-tokyo-love': 'Tokyo Love',
      'theme-manchester-sea': 'Manchester by the Sea',
      'theme-chinese-odyssey': 'Chinese Odyssey',
      themeSaved: 'Theme saved',
      themeSaveFailed: 'Couldn’t save theme',
      filename: 'Filename',
      filenameRule: 'Filename rule',
      customTemplate: 'Custom template',
      presetIndexKind: 'Default (index-type)',
      presetDefault: 'Title - Author',
      presetAuthorTitle: 'Author - Title',
      presetTitle: 'Title only',
      presetTitleId: 'Title - Note ID',
      presetDetailed: 'Title - Author - Type',
      presetCustom: 'Custom…',
      chipTitle: 'Title',
      chipAuthor: 'Author',
      chipId: 'Note ID',
      chipIndex: 'Index',
      chipKind: 'Type',
      chipDate: 'Date',
      preview: 'Preview: {name}',
      previewEmpty: 'Preview unavailable',
      invalidTemplate: 'Invalid filename template',
      invalidTemplateChars: 'No paths or invalid characters',
      invalidTemplateFormat: 'Field format: {title}',
      unknownToken: 'Unknown field: {token}',
      sampleTitle: 'Sample note title',
      sampleAuthor: 'Sample author',
      saved: 'Saved',
      viewDownloads: 'View downloads',
      cannotOpenDownloads: 'Cannot open downloads',
      restored: 'Restored defaults',
      restoreFailed: 'Couldn’t restore',
      resetDefault: 'Reset',
      settingsHint: 'Queued downloads keep running',
      modeLabel: 'Download mode',
      currentContent: 'Current note',
      creator: 'Notes',
      refreshPosts: 'Refresh',
      downloadSelectedCovers: 'Download selected',
      creatorDownloadHint: 'Image notes: all images. Video notes: video.',
      creatorCollectHint: 'Collections · Download images or videos.',
      creatorLikesHint: 'Likes · Download images or videos.',
      creatorGoProfile: 'Open a profile and select notes.',
      openCreatorProfile: 'Open profile',
      creatorEmptyTitle: 'No notes yet',
      creatorEmptyDetail: 'Scroll to load more, then refresh.',
      scanReady: 'Ready',
      scanReadyCount: 'Read {count} notes',
      creatorStats: '{total} total · {downloaded} saved',
      listNoteCount: '{count} posts',
      selectAllShort: 'Select all',
      selectNewShort: 'Not downloaded',
      clearShort: 'Clear',
      selectedCount: '{count} selected',
      countNotes: '{count} notes',
      coverUnavailable: 'No cover',
      selectCoversFirst: 'Select notes',
      statusDownloaded: 'Downloaded',
      statusNew: 'Not downloaded',
      needSupportedPage: 'Open a note or profile',
      recognizedProfile: 'Profile ready',
      readyProfile: 'Select notes to download images or videos.',
      notSupportedPage: 'Downloads unavailable on this page'
    }
  };

  let language = 'zh-CN';
  let preference = 'zh-CN';
  const listeners = new Set();

  function storageGet(key) {
    return new Promise((resolve) => {
      try {
        const api = typeof browser !== 'undefined' ? browser : chrome;
        api.storage.local.get(key, (r) => resolve(r || {}));
      } catch (_) {
        resolve({});
      }
    });
  }

  function storageSet(obj) {
    return new Promise((resolve) => {
      try {
        const api = typeof browser !== 'undefined' ? browser : chrome;
        api.storage.local.set(obj, () => resolve());
      } catch (_) {
        resolve();
      }
    });
  }

  function normalize(value) {
    if (value === 'en' || value === 'zh-CN') return value;
    return '';
  }

  function browserLanguage() {
    try {
      const lang = String(root.navigator?.language || root.navigator?.userLanguage || '').toLowerCase();
      if (lang.startsWith('zh')) return 'zh-CN';
    } catch (_) {}
    return 'en';
  }

  function resolve(value) {
    return normalize(value) || browserLanguage();
  }

  function t(key, values) {
    const template = messages[language]?.[key] ?? messages.en?.[key] ?? messages['zh-CN']?.[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? ''));
  }

  function apply(scope) {
    const node = scope?.querySelectorAll ? scope : root.document;
    if (!node?.querySelectorAll) return language;
    if (node.documentElement) node.documentElement.lang = language === 'zh-CN' ? 'zh-CN' : 'en';
    node.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    node.querySelectorAll('[data-i18n-aria]').forEach((element) => {
      element.setAttribute('aria-label', t(element.dataset.i18nAria));
    });
    node.querySelectorAll('[data-i18n-title]').forEach((element) => {
      const values = {};
      if (element.dataset.feedbackEmail) values.email = element.dataset.feedbackEmail;
      element.title = t(element.dataset.i18nTitle, values);
    });
    return language;
  }

  function emit() {
    listeners.forEach((listener) => {
      try { listener({ preference, language }); } catch (_) {}
    });
  }

  const ready = storageGet(KEY).then((stored) => {
    language = resolve(stored?.[KEY]);
    preference = language;
    return { preference, language };
  }).catch(() => ({ preference, language }));

  async function save(value) {
    language = resolve(value);
    preference = language;
    await storageSet({ [KEY]: language });
    emit();
    return { preference, language };
  }

  kit.i18n = {
    KEY,
    ready,
    preference: () => preference,
    language: () => language,
    browserLanguage,
    resolve,
    t,
    apply,
    save,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
