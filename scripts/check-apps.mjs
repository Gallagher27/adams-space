import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteContent } from "../content/site-content.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainSiteUrl = new URL(siteContent.site.url);
const mainSiteHost = mainSiteUrl.hostname.toLowerCase();
const registeredProjectSlugs = new Set();
const registeredApps = siteContent.projects.filter((project) => project.sourceDir);
const errors = [];
const seenSourceDirs = new Set();

for (const project of siteContent.projects) {
  validateProjectExposure(project);
}

for (const project of registeredApps) {
  if (seenSourceDirs.has(project.sourceDir)) errors.push(`重复的 sourceDir：${project.sourceDir}`);
  seenSourceDirs.add(project.sourceDir);

  if (!project.sourceDir.startsWith("apps/")) errors.push(`${project.slug} 的 sourceDir 必须位于 apps/ 下：${project.sourceDir}`);
  if (!project.runtime) errors.push(`${project.slug} 缺少 runtime`);
  if (!project.deployment) errors.push(`${project.slug} 缺少 deployment`);
  if (!project.path) errors.push(`${project.slug} 缺少公开 path`);

  try {
    await access(path.join(rootDir, project.sourceDir));
  } catch {
    errors.push(`${project.slug} 的源码目录不存在：${project.sourceDir}`);
  }
}

function validateProjectExposure(project) {
  if (!project.slug) {
    errors.push("存在没有 slug 的项目");
    return;
  }
  if (registeredProjectSlugs.has(project.slug)) errors.push(`重复的项目 slug：${project.slug}`);
  registeredProjectSlugs.add(project.slug);

  if (!project.path) {
    errors.push(`${project.slug} 缺少公开 path`);
    return;
  }

  if (/^https?:\/\//i.test(project.path)) {
    let target;
    try {
      target = new URL(project.path);
    } catch {
      errors.push(`${project.slug} 的公开 URL 无法解析：${project.path}`);
      return;
    }

    if (target.protocol !== "https:") errors.push(`${project.slug} 的外部入口必须使用 HTTPS：${project.path}`);
    if (target.hostname.toLowerCase() === mainSiteHost) {
      errors.push(`${project.slug} 不能把外部应用挂回主站 apex：${project.path}`);
    }
    if (!target.hostname.toLowerCase().endsWith(`.${mainSiteHost}`)) {
      errors.push(`${project.slug} 的外部入口必须属于 ${mainSiteHost} 子域：${project.path}`);
    }
    if (target.port) errors.push(`${project.slug} 的外部入口不应暴露非标准端口：${project.path}`);
    if (!project.deployment) errors.push(`${project.slug} 缺少外部 deployment 主机名`);
    if (project.deployment && project.deployment.toLowerCase() !== target.hostname.toLowerCase()) {
      errors.push(`${project.slug} 的 deployment 与公开 URL 主机不一致：${project.deployment} != ${target.hostname}`);
    }
    return;
  }

  if (project.path.startsWith("/") || project.path.startsWith("//")) {
    errors.push(`${project.slug} 的站内入口必须使用相对路径，避免绕过主站路由：${project.path}`);
  }
  if (project.deployment && project.deployment !== "main-site") {
    errors.push(`${project.slug} 是站内入口时 deployment 必须为 main-site：${project.deployment}`);
  }
}

if (errors.length) {
  console.error("应用注册检查失败：");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`应用注册检查通过：${registeredApps.length} 个应用已关联源码、运行方式和公开地址。`);
}
