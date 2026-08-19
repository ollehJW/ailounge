const scopeSelector = (selector) => {
  const value = selector.trim();
  if (!value || value.startsWith(".ai-lounge-scope") || value === "body.modal-open") return value;
  return `.ai-lounge-scope ${value}`;
};

const aiLoungeScope = {
  postcssPlugin: "ai-lounge-scope",
  Rule(rule) {
    const parentName = rule.parent?.type === "atrule" ? rule.parent.name : "";
    if (/keyframes$/i.test(parentName)) return;
    rule.selectors = rule.selectors.map(scopeSelector);
  },
};

export default {
  plugins: [aiLoungeScope],
};
