import { defineConfig } from "wxt";
import { fileURLToPath } from "node:url";

export default defineConfig({
  srcDir: "src",
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
  manifest: {
    name: "AI Bidder for Freelance Jobs",
    description: "Bid on freelance jobs using AI",
    version: "0.1.0",
    permissions: [
      "storage",
      "tabs",
      "activeTab",
      "scripting",
      "contextMenus",
      "alarms",
    ],
    host_permissions: [
      "*://*.freelancer.com/*",
      "*://*.freelancer.com.bd/*",
      "*://*.upwork.com/*",
      "http://localhost:5000/*",
      "ws://localhost:5000/*",
    ],
  },
  modules: ["@wxt-dev/module-react"],
  runner: {
    disabled: true,
  },
});
