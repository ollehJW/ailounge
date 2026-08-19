const scopeSelector = (selector) => {
  const value = selector.trim();
  if (!value || value.startsWith(".ai-lounge-scope") || value === "body.ai-lounge-modal-open") return value;
  return `.ai-lounge-scope ${value}`;
};

const aiLoungeScope = {
  postcssPlugin: "ai-lounge-scope",
  Once(root, { result }) {
    const from = result.opts.from?.replaceAll("\\", "/") ?? "";
    const isAiLoungeSource = from.includes("/frontend_vue/src/") || from.includes("/assets/ai-lounge/");
    if (!isAiLoungeSource) return;

    root.walkRules((rule) => {
      const parentName = rule.parent?.type === "atrule" ? rule.parent.name : "";
      if (/keyframes$/i.test(parentName)) return;
      rule.selectors = rule.selectors.map(scopeSelector);
    });
  },
};

export default {
  plugins: [aiLoungeScope],
};
