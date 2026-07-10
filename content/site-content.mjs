export const siteContent = {
  site: {
    title: "Adam's Space",
    owner: "Adam",
    url: "https://gallagher.lol",
    description:
      "一个持续生长的个人主站，用来放个人简介、项目入口，以及后续慢慢补进来的新页面。",
    footerNote: "Built as a quiet home for projects that keep growing.",
    locale: "zh_CN",
    themeColor: "#f7f6f3",
    year: "2026",
  },
  home: {
    icon: "💡",
    eyebrow: "Personal Hub",
    title: "Adam's Space",
    description:
      "这里先放个人简介、KL Food，以及后面会继续接进来的其他项目。主站保持简洁，但内容会持续往里长。",
    actions: [
      { label: "Open Projects", path: "projects/", variant: "primary" },
      { label: "Read About", path: "about/", variant: "secondary" },
    ],
    stats: [
      { label: "Base", value: "Kuala Lumpur" },
      { label: "Current live project", value: "KL Food Map" },
      { label: "Hosting", value: "GitHub Pages" },
    ],
  },
  profile: {
    shortIntro: [
      "你好，我喜欢把城市探索、吃饭记录和一些顺手的小工具整理成可以长期维护的网页项目。",
      "这个主站会作为统一入口，平时放个人简介、精选项目，以及之后继续扩展的新站和实验页。",
    ],
    longIntro: [
      "我更偏爱简单、安静、能持续维护的网页表达方式。比起一次性堆很多内容，我更希望每个页面都能清楚地回答它为什么存在、能给人什么信息。",
      "现在最完整的项目是 KL Food Map。后面如果再做新的地图、小工具或专题页，也都会先挂到这个主站，再慢慢整理成一个稳定的项目集合。",
      "所以这个网站的角色不是展示一堆华丽页面，而是做一个长期可更新的个人界面。",
    ],
    facts: [
      { label: "Location", value: "Kuala Lumpur, Malaysia" },
      { label: "Current focus", value: "Maps, food notes, and small web projects" },
      { label: "Site role", value: "A lightweight hub for personal work" },
    ],
    interests: ["Food", "Maps", "Code", "Travel", "Photography"],
  },
  navigation: [
    {
      icon: "👤",
      title: "About",
      description: "更完整的个人简介，以及这个主站会怎么继续长出来。",
      path: "about/",
    },
    {
      icon: "🍜",
      title: "KL Food Map",
      description: "目前最完整的在线项目，一个可以持续更新的吉隆坡美食地图。",
      path: "food-map/",
    },
    {
      icon: "🛠️",
      title: "Projects",
      description: "所有项目的统一入口，后面新增的站也会继续接到这里。",
      path: "projects/",
    },
  ],
  projects: [
    {
      slug: "kl-food-map",
      icon: "🍜",
      title: "KL Food Map",
      status: "Live",
      kind: "Internal page",
      path: "food-map/",
      featured: true,
      summary:
        "把自己在吉隆坡想记住的餐厅整理成一个可搜索、可筛选、可导航的互动地图。",
      detail:
        "这个项目既是记录工具，也是之后继续扩展其他城市或专题地图的雏形。现在已经可以按距离、评分和名称浏览，后面也能继续补更多收藏。",
      bullets: [
        "支持搜索餐厅、区域和菜系",
        "可以按距离、评分和名称排序",
        "保留持续导入与扩充的空间",
      ],
      tags: ["Google Maps API", "HTML / CSS / JS", "Responsive", "Food Notes"],
      ctaLabel: "Open project",
    },
    {
      slug: "project-archive",
      icon: "…",
      title: "More Projects",
      status: "Growing",
      kind: "Project shelf",
      path: "projects/",
      featured: false,
      summary:
        "后面新增的小站、实验页或工具页，都会先接到这个主站，再慢慢整理成更完整的项目集合。",
      detail:
        "主站的职责是给每个项目一个稳定入口，而不是一次性塞满内容。它会像一个安静的目录，慢慢把作品接起来。",
      bullets: [
        "可以挂新的内部页面",
        "也可以收纳外部项目链接",
        "保持统一风格和统一入口",
      ],
      tags: ["Collection", "Future Pages", "Growing Archive"],
      ctaLabel: "Browse shelf",
    },
  ],
  projectShelfNote:
    "当前先放 KL Food Map，后面新增项目时，只要补一条项目数据，再把页面目录接进来就可以了。",
};
