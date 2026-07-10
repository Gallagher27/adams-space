import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteContent } from "../content/site-content.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const siteUrl = siteContent.site.url.replace(/\/$/, "");
const buildDate = new Date().toISOString().slice(0, 10);

const featuredProject = siteContent.projects.find((project) => project.featured);

if (!featuredProject) {
  throw new Error("A featured project is required in content/site-content.mjs");
}

const pages = [
  {
    output: "index.html",
    title: `${siteContent.site.title}`,
    description: siteContent.site.description,
    currentPath: "",
    priority: "1.0",
    body: renderHomePage(),
  },
  {
    output: path.join("about", "index.html"),
    title: `About - ${siteContent.site.title}`,
    description: "个人简介，以及这个主站会怎么持续扩展。",
    currentPath: "about/",
    priority: "0.8",
    body: renderAboutPage(),
  },
  {
    output: path.join("projects", "index.html"),
    title: `Projects - ${siteContent.site.title}`,
    description: "项目入口页，当前以 KL Food Map 为主，后续会继续扩展。",
    currentPath: "projects/",
    priority: "0.9",
    body: renderProjectsPage(),
  },
];

const staticRoutes = [
  {
    path: "food-map/",
    priority: "0.9",
  },
];

await Promise.all(
  pages.map(async (page) => {
    const outputPath = path.join(rootDir, page.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      renderLayout({
        title: page.title,
        description: page.description,
        currentPath: page.currentPath,
        body: page.body,
      }),
      "utf8",
    );
  }),
);

await Promise.all([
  writeFile(path.join(rootDir, "sitemap.xml"), renderSitemap(), "utf8"),
  writeFile(path.join(rootDir, "robots.txt"), renderRobotsTxt(), "utf8"),
  writeFile(path.join(rootDir, "site.webmanifest"), renderWebManifest(), "utf8"),
  writeFile(path.join(rootDir, ".nojekyll"), "", "utf8"),
  writeFile(
    path.join(rootDir, "404.html"),
    renderLayout({
      title: `Page not found - ${siteContent.site.title}`,
      description: "这个页面暂时不存在，可以回到 Adam's Space 继续浏览项目入口。",
      currentPath: "",
      body: renderNotFoundPage(),
    }),
    "utf8",
  ),
]);

console.log(`Built ${pages.length} pages and site metadata for ${siteContent.site.title}.`);

function renderLayout({ title, description, currentPath, body }) {
  const canonicalUrl = absoluteUrl(currentPath);
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteContent.site.title,
    url: `${siteUrl}/`,
    description: siteContent.site.description,
    author: {
      "@type": "Person",
      name: siteContent.site.owner,
    },
  };

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="theme-color" content="${escapeHtml(siteContent.site.themeColor)}" />
  <meta name="color-scheme" content="light" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="icon" href="${hrefFor(currentPath, "assets/favicon.svg")}" type="image/svg+xml" />
  <link rel="manifest" href="${hrefFor(currentPath, "site.webmanifest")}" />
  <meta property="og:site_name" content="${escapeHtml(siteContent.site.title)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:locale" content="${escapeHtml(siteContent.site.locale)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <link rel="stylesheet" href="${hrefFor(currentPath, "assets/site.css")}" />
  <script type="application/ld+json">${escapeScriptJson(schema)}</script>
</head>
<body>
  <div class="page">
    ${renderTopbar(currentPath)}
    ${body}
    <footer class="footer">© ${escapeHtml(siteContent.site.year)} ${escapeHtml(siteContent.site.owner)} · ${escapeHtml(siteContent.site.footerNote)}</footer>
  </div>
</body>
</html>
`;
}

function renderNotFoundPage() {
  return `
    <section class="hero">
      <div class="hero-icon">?</div>
      <div class="eyebrow">404</div>
      <h1 class="page-title">页面暂时不存在</h1>
      <p class="page-desc">这个入口可能还没接进来，或者链接已经移动。可以先回到主站首页，继续看个人简介和项目集合。</p>
      <div class="hero-actions">
        <a class="button button-primary" href="./">Back Home</a>
        <a class="button button-secondary" href="projects/">Open Projects</a>
      </div>
    </section>
  `;
}

function renderSitemap() {
  const routes = [
    ...pages.map((page) => ({ path: page.currentPath, priority: page.priority })),
    ...staticRoutes,
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${escapeXml(absoluteUrl(route.path))}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

function renderRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
}

function renderWebManifest() {
  return `${JSON.stringify(
    {
      name: siteContent.site.title,
      short_name: "Adam Space",
      description: siteContent.site.description,
      start_url: "/",
      display: "minimal-ui",
      background_color: "#ffffff",
      theme_color: siteContent.site.themeColor,
      icons: [
        {
          src: "/assets/favicon.svg",
          sizes: "any",
          type: "image/svg+xml",
        },
      ],
    },
    null,
    2,
  )}
`;
}

function renderTopbar(currentPath) {
  const navItems = [
    { label: "Home", path: "" },
    { label: "About", path: "about/" },
    { label: "Projects", path: "projects/" },
    { label: "KL Food", path: "food-map/" },
  ];

  return `
    <header class="topbar">
      <a class="brand" href="${hrefFor(currentPath, "")}">
        <span class="brand-mark">✦</span>
        <span class="brand-copy">
          <span class="brand-title">${escapeHtml(siteContent.site.title)}</span>
          <span class="brand-subtitle">${escapeHtml(siteContent.site.description)}</span>
        </span>
      </a>
      <nav class="nav-pills" aria-label="Primary">
        ${navItems
          .map((item) => {
            const activeClass = item.path === currentPath ? " is-active" : "";
            return `<a class="nav-pill${activeClass}" href="${hrefFor(currentPath, item.path)}">${escapeHtml(item.label)}</a>`;
          })
          .join("")}
      </nav>
    </header>
  `;
}

function renderHomePage() {
  return `
    <section class="hero">
      <div class="hero-icon">${escapeHtml(siteContent.home.icon)}</div>
      <div class="eyebrow">${escapeHtml(siteContent.home.eyebrow)}</div>
      <h1 class="page-title">${escapeHtml(siteContent.home.title)}</h1>
      <p class="page-desc">${escapeHtml(siteContent.home.description)}</p>
      <div class="hero-actions">
        ${siteContent.home.actions
          .map((action) => {
            const variantClass =
              action.variant === "primary" ? "button-primary" : "button-secondary";
            return `<a class="button ${variantClass}" href="${hrefFor("", action.path)}">${escapeHtml(action.label)}</a>`;
          })
          .join("")}
      </div>
      <div class="hero-stats">
        ${siteContent.home.stats
          .map(
            (stat) => `
              <div class="stat-card">
                <span class="stat-label">${escapeHtml(stat.label)}</span>
                <span class="stat-value">${escapeHtml(stat.value)}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="grid grid-two">
      <article class="section-card section-card--soft">
        <h2 class="section-title"><span class="section-title-icon">👋</span>Personal Profile</h2>
        ${siteContent.profile.shortIntro
          .map((paragraph) => `<p class="section-copy">${escapeHtml(paragraph)}</p>`)
          .join("")}
        <div class="tag-list">
          ${siteContent.profile.interests
            .map((item) => `<span class="tag">${escapeHtml(item)}</span>`)
            .join("")}
        </div>
        <a class="button button-secondary button-inline" href="${hrefFor("", "about/")}">Read full profile</a>
      </article>

      <aside class="section-card">
        <h2 class="section-title"><span class="section-title-icon">📌</span>Quick Facts</h2>
        <div class="meta-list">
          ${siteContent.profile.facts
            .map(
              (fact) => `
                <div class="meta-row">
                  <div class="meta-label">${escapeHtml(fact.label)}</div>
                  <div class="meta-value">${escapeHtml(fact.value)}</div>
                </div>
              `,
            )
            .join("")}
        </div>
      </aside>
    </section>

    <section class="section-card" style="margin-top: 20px;">
      <h2 class="section-title"><span class="section-title-icon">🧭</span>Main Sections</h2>
      <div class="link-grid">
        ${siteContent.navigation
          .map(
            (item) => `
              <a class="link-card" href="${hrefFor("", item.path)}">
                <span class="link-card-icon">${escapeHtml(item.icon)}</span>
                <div>
                  <h3 class="link-card-title">${escapeHtml(item.title)}</h3>
                  <p class="link-card-desc">${escapeHtml(item.description)}</p>
                </div>
              </a>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="section-card" style="margin-top: 20px;">
      <h2 class="section-title"><span class="section-title-icon">🌟</span>Featured Project</h2>
      ${renderFeaturedProject(featuredProject, "")}
    </section>

    <section class="section-card" style="margin-top: 20px;">
      <h2 class="section-title"><span class="section-title-icon">🗂️</span>Project Shelf</h2>
      <p class="section-copy">${escapeHtml(siteContent.projectShelfNote)}</p>
      <div class="project-grid">
        ${siteContent.projects
          .map((project) => renderProjectListCard(project, ""))
          .join("")}
      </div>
    </section>
  `;
}

function renderAboutPage() {
  return `
    <a class="breadcrumb" href="${hrefFor("about/", "")}">← Back to home</a>
    <section class="hero">
      <div class="hero-icon">👤</div>
      <div class="eyebrow">About</div>
      <h1 class="page-title">个人简介</h1>
      <p class="page-desc">这个页面把人和站点的关系说清楚，也方便后面继续往主站里接新的项目。</p>
    </section>

    <section class="grid grid-two">
      <article class="section-card section-card--soft">
        <h2 class="section-title"><span class="section-title-icon">✍️</span>About Me</h2>
        ${siteContent.profile.longIntro
          .map((paragraph) => `<p class="section-copy">${escapeHtml(paragraph)}</p>`)
          .join("")}
      </article>

      <aside class="section-card">
        <h2 class="section-title"><span class="section-title-icon">📋</span>At a Glance</h2>
        <div class="meta-list">
          ${siteContent.profile.facts
            .map(
              (fact) => `
                <div class="meta-row">
                  <div class="meta-label">${escapeHtml(fact.label)}</div>
                  <div class="meta-value">${escapeHtml(fact.value)}</div>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="tag-list" style="margin-top: 18px;">
          ${siteContent.profile.interests
            .map((item) => `<span class="tag">${escapeHtml(item)}</span>`)
            .join("")}
        </div>
      </aside>
    </section>

    <section class="section-card" style="margin-top: 20px;">
      <h2 class="section-title"><span class="section-title-icon">🏠</span>Why This Site Exists</h2>
      <p class="section-copy">主站会一直保持比较轻的 Notion 风格，不追求过度包装，而是把个人信息和项目入口组织得更清楚。</p>
      <p class="section-copy">未来如果有新的地图页、工具页、实验页或其他独立小站，都会继续挂到这里，主站就像一个持续更新的目录。</p>
      <div class="callout">现在先放个人简介和 KL Food Map，后面再按同样方式往里接新项目，不需要重做整站结构。</div>
    </section>

    <section class="section-card" style="margin-top: 20px;">
      <h2 class="section-title"><span class="section-title-icon">🧭</span>Go Next</h2>
      <div class="link-grid">
        ${siteContent.navigation
          .map(
            (item) => `
              <a class="link-card" href="${hrefFor("about/", item.path)}">
                <span class="link-card-icon">${escapeHtml(item.icon)}</span>
                <div>
                  <h3 class="link-card-title">${escapeHtml(item.title)}</h3>
                  <p class="link-card-desc">${escapeHtml(item.description)}</p>
                </div>
              </a>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderProjectsPage() {
  return `
    <a class="breadcrumb" href="${hrefFor("projects/", "")}">← Back to home</a>
    <section class="hero">
      <div class="hero-icon">🛠️</div>
      <div class="eyebrow">Projects</div>
      <h1 class="page-title">项目入口</h1>
      <p class="page-desc">这里会收纳当前项目和后续新增的小站。现在先以 KL Food Map 为主，后面继续往这个 shelf 里追加。</p>
    </section>

    <section class="section-card">
      <h2 class="section-title"><span class="section-title-icon">🍜</span>Current Featured Work</h2>
      ${renderFeaturedProject(featuredProject, "projects/")}
    </section>

    <section class="section-card" style="margin-top: 20px;">
      <h2 class="section-title"><span class="section-title-icon">🗃️</span>Project Shelf</h2>
      <p class="section-copy">${escapeHtml(siteContent.projectShelfNote)}</p>
      <div class="project-grid">
        ${siteContent.projects
          .map((project) => renderProjectListCard(project, "projects/"))
          .join("")}
      </div>
    </section>

    <section class="section-card section-card--soft" style="margin-top: 20px;">
      <h2 class="section-title"><span class="section-title-icon">🌱</span>How This Will Grow</h2>
      <p class="section-copy">后面新增项目时，不需要再把首页、项目页和简介页分别手改一遍。只要按统一结构补内容，主站就会自然更新。</p>
      <div class="callout">这让主站更像一个长期维护的个人项目目录，而不是一次性做完的静态落地页。</div>
    </section>
  `;
}

function renderFeaturedProject(project, currentPath) {
  return `
    <article class="project-card featured">
      <div>
        <div class="project-head">
          <div class="project-title-wrap">
            <span class="project-icon">${escapeHtml(project.icon)}</span>
            <div>
              <h3 class="project-title">${escapeHtml(project.title)}</h3>
              <p class="project-summary">${escapeHtml(project.summary)}</p>
            </div>
          </div>
          <span class="status-pill">${escapeHtml(project.status)}</span>
        </div>
        <p class="project-detail" style="margin-top: 14px;">${escapeHtml(project.detail)}</p>
        <ul class="bullet-list" style="margin-top: 16px;">
          ${project.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <div class="tag-list" style="margin-top: 16px;">
          ${project.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
      <div class="section-card section-card--soft" style="padding: 18px;">
        <h4 style="margin: 0 0 12px; font-size: 15px;">Project Notes</h4>
        <div class="meta-list">
          <div class="meta-row">
            <div class="meta-label">Type</div>
            <div class="meta-value">${escapeHtml(project.kind)}</div>
          </div>
          <div class="meta-row">
            <div class="meta-label">Status</div>
            <div class="meta-value">${escapeHtml(project.status)}</div>
          </div>
          <div class="meta-row">
            <div class="meta-label">Role here</div>
            <div class="meta-value">主站当前的代表项目，也是之后继续扩展的起点。</div>
          </div>
        </div>
        <a class="button button-primary button-inline" href="${hrefFor(currentPath, project.path)}">${escapeHtml(project.ctaLabel)}</a>
      </div>
    </article>
  `;
}

function renderProjectListCard(project, currentPath) {
  return `
    <article class="project-list-card">
      <div class="project-head">
        <div class="project-title-wrap">
          <span class="project-icon">${escapeHtml(project.icon)}</span>
          <div>
            <h3 class="project-title" style="font-size: 18px; margin-bottom: 2px;">${escapeHtml(project.title)}</h3>
            <p class="project-detail">${escapeHtml(project.summary)}</p>
          </div>
        </div>
        <span class="status-pill">${escapeHtml(project.status)}</span>
      </div>
      <div class="pill-list">
        <span class="pill">${escapeHtml(project.kind)}</span>
        ${project.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <p class="section-copy" style="margin: 0;">${escapeHtml(project.detail)}</p>
      <a class="button button-secondary" href="${hrefFor(currentPath, project.path)}">${escapeHtml(project.ctaLabel)}</a>
    </article>
  `;
}

function hrefFor(currentPath, targetPath) {
  if (/^https?:\/\//.test(targetPath)) {
    return targetPath;
  }

  const depth = currentPath === "" ? 0 : currentPath.split("/").filter(Boolean).length;
  const prefix = "../".repeat(depth);

  if (targetPath === "") {
    return prefix || "./";
  }

  return `${prefix}${targetPath}`;
}

function absoluteUrl(targetPath) {
  if (targetPath === "") {
    return `${siteUrl}/`;
  }

  return `${siteUrl}/${targetPath.replace(/^\/+/, "")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replaceAll("</", "<\\/");
}
