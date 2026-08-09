type XmlNode = {
  name: string;
  attrs: Record<string, string>;
  children: Array<XmlNode | string>;
};

function localName(name: string) {
  return name.split(":").pop() ?? name;
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseXmlFragment(xml: string): XmlNode {
  const root: XmlNode = { name: "root", attrs: {}, children: [] };
  const stack = [root];

  for (const match of xml.matchAll(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
    const token = match[0];
    if (token.startsWith("<!--") || token.startsWith("<?") || token.startsWith("<!")) continue;
    if (token.startsWith("</")) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (!token.startsWith("<")) {
      stack[stack.length - 1].children.push(decodeXml(token));
      continue;
    }

    const open = token.match(/^<\s*([^\s/>]+)/);
    if (!open) continue;
    const node: XmlNode = { name: localName(open[1]), attrs: {}, children: [] };
    for (const attr of token.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      node.attrs[localName(attr[1])] = decodeXml(attr[2] ?? attr[3] ?? "");
    }
    stack[stack.length - 1].children.push(node);
    if (!/\/\s*>$/.test(token)) stack.push(node);
  }

  return root;
}

function child(node: XmlNode, name: string) {
  return node.children.find((item): item is XmlNode => typeof item !== "string" && item.name === name);
}

function descendants(node: XmlNode, name: string): XmlNode[] {
  const found: XmlNode[] = [];
  for (const item of node.children) {
    if (typeof item === "string") continue;
    if (item.name === name) found.push(item);
    found.push(...descendants(item, name));
  }
  return found;
}

const SYMBOLS: Record<string, string> = {
  "∞": "\\infty ", "≤": "\\le ", "≥": "\\ge ", "≠": "\\ne ",
  "≈": "\\approx ", "±": "\\pm ", "∓": "\\mp ", "×": "\\times ",
  "÷": "\\div ", "∈": "\\in ", "∉": "\\notin ", "∪": "\\cup ",
  "∩": "\\cap ", "→": "\\to ", "←": "\\leftarrow ", "↔": "\\leftrightarrow ",
  "⇒": "\\Rightarrow ", "⇔": "\\Leftrightarrow ", "∑": "\\sum ", "∏": "\\prod ",
  "∫": "\\int ", "√": "\\sqrt{}", "α": "\\alpha ", "β": "\\beta ",
  "γ": "\\gamma ", "δ": "\\delta ", "Δ": "\\Delta ", "θ": "\\theta ",
  "λ": "\\lambda ", "μ": "\\mu ", "π": "\\pi ", "φ": "\\varphi ",
  "ω": "\\omega ", "ℝ": "\\mathbb{R}", "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}",
};

function renderText(value: string) {
  return [...value]
    .map((char) => SYMBOLS[char] ?? (char === "&" ? "\\&" : char))
    .join("");
}

function renderChildren(node: XmlNode, separator = "") {
  return node.children
    .filter((item) => typeof item === "string" || !item.name.endsWith("Pr"))
    .map((item) => typeof item === "string" ? renderText(item) : renderNode(item))
    .filter(Boolean)
    .join(separator);
}

function renderedChild(node: XmlNode, name: string) {
  const value = child(node, name);
  return value ? renderChildren(value) : "";
}

function propertyValue(node: XmlNode, name: string) {
  return descendants(node, name)[0]?.attrs.val;
}

function delimiter(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  if (value === "{") return "\\{";
  if (value === "}") return "\\}";
  return value;
}

function renderNode(node: XmlNode): string {
  if (node.name === "t") return renderChildren(node);
  if (node.name.endsWith("Pr") || node.name === "ctrlPr") return "";

  switch (node.name) {
    case "f":
      return `\\frac{${renderedChild(node, "num")}}{${renderedChild(node, "den")}}`;
    case "sSup":
      return `{${renderedChild(node, "e")}}^{${renderedChild(node, "sup")}}`;
    case "sSub":
      return `{${renderedChild(node, "e")}}_{${renderedChild(node, "sub")}}`;
    case "sSubSup":
      return `{${renderedChild(node, "e")}}_{${renderedChild(node, "sub")}}^{${renderedChild(node, "sup")}}`;
    case "rad": {
      const degree = renderedChild(node, "deg");
      return degree
        ? `\\sqrt[${degree}]{${renderedChild(node, "e")}}`
        : `\\sqrt{${renderedChild(node, "e")}}`;
    }
    case "d": {
      const begin = delimiter(propertyValue(node, "begChr"), "(");
      const end = delimiter(propertyValue(node, "endChr"), ")");
      const contents = node.children
        .filter((item): item is XmlNode => typeof item !== "string" && item.name === "e")
        .map((item) => renderChildren(item))
        .join(",");
      return `\\left${begin}${contents}\\right${end}`;
    }
    case "nary": {
      const operator = renderText(propertyValue(node, "chr") ?? "∫").trim();
      const lower = renderedChild(node, "sub");
      const upper = renderedChild(node, "sup");
      return `${operator}${lower ? `_{${lower}}` : ""}${upper ? `^{${upper}}` : ""}${renderedChild(node, "e")}`;
    }
    case "func": {
      const name = renderedChild(node, "fName").trim();
      const known = /^(sin|cos|tan|cot|log|ln|lim|max|min)$/i.test(name)
        ? `\\${name.toLowerCase()}`
        : name;
      return `${known} ${renderedChild(node, "e")}`;
    }
    case "acc": {
      const accent = propertyValue(node, "chr") ?? "^";
      const command = accent === "¯" || accent === "̅" ? "overline" : accent === "→" ? "vec" : accent === "˙" ? "dot" : "hat";
      return `\\${command}{${renderedChild(node, "e")}}`;
    }
    case "bar": {
      const command = propertyValue(node, "pos") === "bot" ? "underline" : "overline";
      return `\\${command}{${renderedChild(node, "e")}}`;
    }
    case "limLow":
      return `{${renderedChild(node, "e")}}_{${renderedChild(node, "lim")}}`;
    case "limUpp":
      return `{${renderedChild(node, "e")}}^{${renderedChild(node, "lim")}}`;
    case "groupChr": {
      const command = propertyValue(node, "pos") === "bot" ? "underbrace" : "overbrace";
      return `\\${command}{${renderedChild(node, "e")}}`;
    }
    case "eqArr":
      return `\\begin{aligned}${node.children
        .filter((item): item is XmlNode => typeof item !== "string" && item.name === "e")
        .map((item) => renderChildren(item))
        .join("\\\\") }\\end{aligned}`;
    case "m": {
      const rows = node.children.filter((item): item is XmlNode => typeof item !== "string" && item.name === "mr");
      return `\\begin{matrix}${rows.map((row) => row.children
        .filter((item): item is XmlNode => typeof item !== "string" && item.name === "e")
        .map((item) => renderChildren(item))
        .join("&")).join("\\\\")}\\end{matrix}`;
    }
    default:
      return renderChildren(node);
  }
}

/** Convert a Word-native OMML fragment to KaTeX-compatible LaTeX. */
export function ommlFragmentToLatex(xml: string) {
  return renderChildren(parseXmlFragment(xml))
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Replace native Word equations in document.xml with plain $LaTeX$ Word runs for Mammoth. */
export function convertOmmlInDocumentXml(documentXml: string) {
  let changed = false;
  const replace = (block: string) => {
    const latex = ommlFragmentToLatex(block);
    if (!latex) return block;
    changed = true;
    return `<w:r><w:t xml:space="preserve"> $${escapeXml(latex)}$ </w:t></w:r>`;
  };

  let xml = documentXml.replace(/<m:oMathPara\b[^>]*>[\s\S]*?<\/m:oMathPara>/g, replace);
  xml = xml.replace(/<m:oMath\b[^>]*>[\s\S]*?<\/m:oMath>/g, replace);
  return { xml, changed };
}
