import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteContent } from "../content/site-content.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registeredApps = siteContent.projects.filter((project) => project.sourceDir);
const errors = [];
const seenSlugs = new Set();
const seenSourceDirs = new Set();

for (const project of registeredApps) {
  if (seenSlugs.has(project.slug)) errors.push(`重复的项目 slug：${project.slug}`);
  if (seenSourceDirs.has(project.sourceDir)) errors.push(`重复的 sourceDir：${project.sourceDir}`);
  seenSlugs.add(project.slug);
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

if (errors.length) {
  console.error("应用注册检查失败：");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`应用注册检查通过：${registeredApps.length} 个应用已关联源码、运行方式和公开地址。`);
}
