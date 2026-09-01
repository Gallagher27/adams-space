export const siteContent = {
  site: {
    title: "Adam's Space",
    owner: "Adam",
    url: "https://gallagher.lol",
    description:
      "一个持续生长的个人主站，用来放个人简介、项目入口，以及后续慢慢补进来的新页面。",
    tagline: {
      zh: "个人主页",
      en: "Personal space",
    },
    footerNote: {
      zh: "为持续生长的项目留一个安静的入口。",
      en: "A quiet home for projects that keep growing.",
    },
    locale: "zh_CN",
    themeColor: "#f7f6f3",
    year: "2026",
  },
  home: {
    kicker: {
      zh: "个人主页",
      en: "PERSONAL SPACE",
    },
    title: {
      zh: "你好，我是 Adam。",
      en: "Hi, I'm Adam.",
    },
    description: {
      zh: "这里是我的个人介绍和项目入口。",
      en: "This is my personal space and project shelf.",
    },
    location: {
      label: {
        zh: "现在在",
        en: "Based in",
      },
      value: "Kuala Lumpur, Malaysia",
    },
    focus: {
      label: {
        zh: "正在做",
        en: "Working on",
      },
      value: {
        zh: "地图、食物记录和小工具",
        en: "Maps, food notes, and small tools",
      },
    },
    actions: {
      projects: {
        zh: "查看项目",
        en: "View projects",
      },
      about: {
        zh: "个人介绍",
        en: "About me",
      },
    },
    sectionLabels: {
      profile: {
        zh: "关于我",
        en: "About me",
      },
      projects: {
        zh: "项目",
        en: "Selected projects",
      },
      open: {
        zh: "打开",
        en: "Open",
      },
    },
    stats: [
      { label: "Base", value: "Kuala Lumpur" },
      { label: "Current live project", value: "KL Food Map" },
      { label: "Hosting", value: "GitHub Pages" },
    ],
  },
  profile: {
    shortIntro: [
      {
        zh: "你好，我喜欢把城市探索、吃饭记录和一些顺手的小工具整理成可以长期维护的网页项目。",
        en: "I like turning city explorations, food notes, and useful little tools into web projects that can last.",
      },
      {
        zh: "这个主站会作为统一入口，平时放个人简介、精选项目，以及之后继续扩展的新站和实验页。",
        en: "This site is a single entry point for my profile, selected work, and future experiments.",
      },
    ],
    longIntro: [
      {
        zh: "我更偏爱简单、安静、能持续维护的网页表达方式。比起一次性堆很多内容，我更希望每个页面都能清楚地回答它为什么存在、能给人什么信息。",
        en: "I prefer web pages that feel simple, quiet, and easy to maintain. Rather than filling a page all at once, I want each one to be clear about why it exists and what it offers.",
      },
      {
        zh: "现在最完整的项目是 KL Food Map。后面如果再做新的地图、小工具或专题页，也都会先挂到这个主站，再慢慢整理成一个稳定的项目集合。",
        en: "The most complete project so far is KL Food Map. New maps, small tools, and special pages will first live here before becoming part of a more stable collection.",
      },
      {
        zh: "所以这个网站的角色不是展示一堆华丽页面，而是做一个长期可更新的个人界面。",
        en: "This site is not meant to be a gallery of polished pages. It is a personal interface that can keep changing over time.",
      },
    ],
    facts: [
      { label: { zh: "位置", en: "Location" }, value: { zh: "吉隆坡，马来西亚", en: "Kuala Lumpur, Malaysia" } },
      { label: { zh: "当前方向", en: "Current focus" }, value: { zh: "地图、食物记录和小型网页项目", en: "Maps, food notes, and small web projects" } },
      { label: { zh: "网站角色", en: "Site role" }, value: { zh: "一个轻量的个人项目入口", en: "A lightweight hub for personal work" } },
    ],
    interests: ["Food", "Maps", "Code", "Travel", "Photography"],
  },
  navigation: [
    {
      icon: "👤",
      title: { zh: "关于", en: "About" },
      description: { zh: "更完整的个人简介，以及这个主站会怎么继续长出来。", en: "A fuller profile and a little more about how this site will grow." },
      path: "about/",
    },
    {
      icon: "🍜",
      title: { zh: "KL Food Map", en: "KL Food Map" },
      description: { zh: "目前最完整的在线项目，一个可以持续更新的吉隆坡美食地图。", en: "The most complete project so far: an evolving food map for Kuala Lumpur." },
      path: "food-map/",
    },
    {
      icon: "↔",
      title: { zh: "汇率转换", en: "Currency Converter" },
      description: { zh: "人民币、美元、马币和其他常用币种的相互换算工具。", en: "A two-way converter for CNY, USD, MYR, and other everyday currencies." },
      path: "currency-converter/",
    },
    {
      icon: "🛠️",
      title: { zh: "项目", en: "Projects" },
      description: { zh: "所有项目的统一入口，后面新增的站也会继续接到这里。", en: "A single entry point for current work and whatever comes next." },
      path: "projects/",
    },
  ],
  projects: [
    {
      slug: "kl-food-map",
      icon: "🍜",
      title: { zh: "KL Food Map", en: "KL Food Map" },
      status: { zh: "在线", en: "Live" },
      kind: { zh: "内部页面", en: "Internal page" },
      sourceDir: "apps/food-map",
      runtime: "static",
      deployment: "main-site",
      path: "food-map/",
      featured: true,
      summary: {
        zh: "把自己在吉隆坡想记住的餐厅整理成一个可搜索、可筛选、可导航的互动地图。",
        en: "A searchable, filterable, and navigable map of restaurants worth remembering in Kuala Lumpur.",
      },
      homeSummary: {
        zh: "一个可以搜索、筛选和导航的吉隆坡美食地图。",
        en: "A searchable, filterable food map for Kuala Lumpur.",
      },
      detail: {
        zh: "这个项目既是记录工具，也是之后继续扩展其他城市或专题地图的雏形。现在已经可以按距离、评分和名称浏览，后面也能继续补更多收藏。",
        en: "It is both a personal record and a starting point for future city or topic maps. Restaurants can be browsed by distance, rating, and name, with more to come.",
      },
      bullets: [
        { zh: "支持搜索餐厅、区域和菜系", en: "Search restaurants, areas, and cuisines" },
        { zh: "可以按距离、评分和名称排序", en: "Sort by distance, rating, or name" },
        { zh: "保留持续导入与扩充的空间", en: "Leave room for ongoing imports and additions" },
      ],
      tags: ["Google Maps API", "HTML / CSS / JS", "Responsive", "Food Notes"],
      ctaLabel: { zh: "打开项目", en: "Open project" },
    },
    {
      slug: "currency-converter",
      icon: "↔",
      title: { zh: "汇率转换", en: "Currency Converter" },
      status: { zh: "在线", en: "Live" },
      kind: { zh: "工具页", en: "Utility" },
      sourceDir: "apps/currency-converter",
      runtime: "static",
      deployment: "main-site",
      path: "currency-converter/",
      featured: false,
      summary: {
        zh: "一个可以从人民币、美元、马币或其他币种直接开始的相互换算工具。",
        en: "A two-way converter that lets you start with CNY, USD, MYR, or another supported currency.",
      },
      homeSummary: {
        zh: "人民币、美元、马币和其他常用币种的相互换算。",
        en: "Quick two-way conversion across everyday currencies.",
      },
      detail: {
        zh: "支持常用数量单位快捷输入，所有币种平级展示，打开后可以主动刷新最新汇率。",
        en: "It supports quick quantity shortcuts, gives every currency equal weight, and lets you refresh the latest rates on demand.",
      },
      bullets: [
        { zh: "人民币、美元、马币和备选币种平级输入", en: "Enter CNY, USD, MYR, or optional currencies equally" },
        { zh: "支持 K / M / B、万 / 千万 / 亿等易读单位", en: "Use readable K / M / B and Chinese quantity shortcuts" },
        { zh: "可按需增减展示币种，适合桌面端和手机端", en: "Add or remove currencies on desktop or mobile" },
      ],
      tags: ["HTML / CSS / JS", "Exchange Rates", "Responsive"],
      ctaLabel: { zh: "打开转换器", en: "Open converter" },
    },
    {
      slug: "voice-lab",
      icon: "🎙️",
      title: { zh: "Voice Lab 演讲训练", en: "Voice Lab" },
      status: { zh: "在线", en: "Live" },
      kind: { zh: "训练工具", en: "Training tool" },
      sourceDir: "apps/voice-lab",
      runtime: "cloudflare-worker",
      deployment: "voice-lab.gallagher.lol",
      path: "https://voice-lab.gallagher.lol/",
      featured: false,
      summary: {
        zh: "把英文演讲稿转换成更自然的朗读音频，并配合分段、高亮和历史记录进行练习。",
        en: "A speech-training workspace for natural English narration, guided highlighting, and reusable practice history.",
      },
      homeSummary: {
        zh: "英文演讲训练工具，支持自然朗读、分段高亮和历史复听。",
        en: "English speech practice with natural narration, highlighting, and replayable history.",
      },
      detail: {
        zh: "Voice Lab 是一个独立的演讲训练界面：输入英文后可以分段朗读，播放时同步高亮当前内容，并保留最近的练习记录。",
        en: "Voice Lab is a focused speech-training workspace: paste English, practice it in sections, follow the live highlight, and keep recent sessions available for replay.",
      },
      bullets: [
        { zh: "输入英文后按段落练习", en: "Practice English in focused sections" },
        { zh: "朗读时同步高亮当前内容", en: "Follow the live reading highlight" },
        { zh: "本地保留最近 50 条练习记录", en: "Keep the latest 50 practice sessions locally" },
      ],
      tags: ["Google Cloud TTS", "Speech Practice", "Next.js"],
      ctaLabel: { zh: "开始练习", en: "Start practicing" },
    },
    {
      slug: "cardroom",
      icon: "◉",
      title: { zh: "Cardroom 团队名片关系库", en: "Cardroom · Team Contact Atlas" },
      status: { zh: "在线", en: "Live" },
      kind: { zh: "团队工具", en: "Team workspace" },
      path: "https://cards.gallagher.lol/",
      featured: false,
      summary: {
        zh: "把团队名片整理成可共享、可检索的联系人数据库，并按公司查看关系网络。",
        en: "A shared contact database that turns business cards into searchable company networks.",
      },
      homeSummary: {
        zh: "团队名片 OCR 与关系网络工具，支持共享上传、公司视图和中英文使用。",
        en: "A shared business-card workspace with OCR, company networks, and bilingual access.",
      },
      detail: {
        zh: "共享名片库，支持图片上传、OCR 字段整理、重复项确认、公司关系图和中英文切换。",
        en: "A shared card library for image upload, OCR field capture, duplicate review, company networks, and bilingual access.",
      },
      bullets: [
        { zh: "支持团队共享上传和查看名片", en: "Share card uploads and browsing across the team" },
        { zh: "按公司查看联系人和关系图", en: "Browse contacts and relationship graphs by company" },
        { zh: "中英文切换，适合跨地区同事共同使用", en: "Switch between Chinese and English for cross-region teams" },
      ],
      tags: ["Cloudflare", "OCR / D1 / R2", "Team Contacts"],
      ctaLabel: { zh: "打开名片库", en: "Open Cardroom" },
    },
    {
      slug: "project-archive",
      icon: "…",
      title: { zh: "更多项目", en: "More Projects" },
      status: { zh: "持续增加", en: "Growing" },
      kind: { zh: "项目集合", en: "Project shelf" },
      path: "projects/",
      featured: false,
      summary: {
        zh: "后面新增的小站、实验页或工具页，都会先接到这个主站，再慢慢整理成更完整的项目集合。",
        en: "New sites, experiments, and tools will start here before becoming part of a fuller project collection.",
      },
      detail: {
        zh: "主站的职责是给每个项目一个稳定入口，而不是一次性塞满内容。它会像一个安静的目录，慢慢把作品接起来。",
        en: "The site gives each project a stable entry point instead of trying to fill everything at once. It is a quiet directory that connects the work over time.",
      },
      bullets: [
        { zh: "可以挂新的内部页面", en: "Add new internal pages" },
        { zh: "也可以收纳外部项目链接", en: "Collect external project links" },
        { zh: "保持统一风格和统一入口", en: "Keep one consistent style and entry point" },
      ],
      tags: ["Collection", "Future Pages", "Growing Archive"],
      ctaLabel: { zh: "浏览项目集合", en: "Browse shelf" },
    },
  ],
  projectShelfNote: {
    zh: "现在这里有 KL Food Map、Voice Lab 和 Cardroom，后面新增项目时，只要补一条项目数据，再把页面目录接进来就可以了。",
    en: "KL Food Map, Voice Lab, and Cardroom are the starting entries. New projects can be added by extending the same small project list.",
  },
};
