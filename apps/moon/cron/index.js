import { rotatePasswordIfDue } from "../worker/index.js";

export default {
  async scheduled(controller, env) {
    if (!env.DB) throw new Error("DB binding is not configured");
    const result = await rotatePasswordIfDue(env.DB, env, controller?.scheduledTime || Date.now());
    console.log("moon_password_rotation", JSON.stringify({ rotated: result.rotated, version: result.version }));
  },
};
