import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"","description":"","frontmatter":{"layout":"home","hero":{"name":"iCloudBridge","text":"User Guide","tagline":"Sync Your Apple Data - Notes, Reminders, Photos & Passwords","image":{"src":"/assets/iCloudBridge_transparent.svg","alt":"iCloudBridge Logo"},"actions":[{"theme":"brand","text":"Get Started","link":"/user"},{"theme":"alt","text":"View on GitHub","link":"https://github.com/keithvassallomt/icloudbridge"}]},"features":[{"icon":"📝","title":"Note Synchronisation","details":"Sync Apple Notes with support for folders, attachments, images, text formatting and checklists","link":"/notes"},{"icon":"✅","title":"Reminder Synchronisation","details":"Sync Apple Reminders with alarms, recurring reminders, time zones and multiple lists","link":"/reminders"},{"icon":"🔐","title":"Password Synchronisation","details":"Sync your Apple Passwords with Bitwarden, Vaultwarden or Nextcloud Passwords","link":"/passwords"},{"icon":"📷","title":"Photo Synchronisation","details":"Sync photos from non-Apple devices to your Apple Photos library","link":"/photos"},{"icon":"⏰","title":"Schedules","details":"Create recurring schedules to automatically sync notes, reminders and photos","link":"/schedules"},{"icon":"📊","title":"Logs","details":"Keep a close eye on everything iCloudBridge is doing, in real time","link":"/logs"}]},"headers":[],"relativePath":"index.md","filePath":"index.md"}');
const _sfc_main = { name: "index.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("index.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  index as default
};
