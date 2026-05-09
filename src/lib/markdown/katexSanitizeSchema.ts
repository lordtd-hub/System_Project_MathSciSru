import type { Schema } from "hast-util-sanitize";
import { defaultSchema } from "rehype-sanitize";

const katexClassName = /^[A-Za-z0-9_-]+$/;

const mathMlTags = [
  "annotation",
  "math",
  "menclose",
  "mfrac",
  "mi",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mroot",
  "mrow",
  "ms",
  "mspace",
  "msqrt",
  "mstyle",
  "msub",
  "msubsup",
  "msup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "semantics"
];

// KaTeX renders math into a constrained set of spans plus MathML. Sanitize must
// run after KaTeX so generated markup is checked, while these allowances keep
// legitimate math classes/MathML from being stripped.
export const katexSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...mathMlTags],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), ["className", katexClassName], "ariaHidden"],
    span: [...(defaultSchema.attributes?.span ?? []), ["className", katexClassName], "ariaHidden", "style"],
    div: [...(defaultSchema.attributes?.div ?? []), ["className", katexClassName]],
    math: [...(defaultSchema.attributes?.math ?? []), "xmlns", "display"],
    annotation: [...(defaultSchema.attributes?.annotation ?? []), "encoding"],
    mspace: [...(defaultSchema.attributes?.mspace ?? []), "width", "height", "depth"],
    mstyle: [...(defaultSchema.attributes?.mstyle ?? []), "scriptlevel", "displaystyle"],
    mpadded: [...(defaultSchema.attributes?.mpadded ?? []), "width", "height", "depth", "lspace", "voffset"],
    menclose: [...(defaultSchema.attributes?.menclose ?? []), "notation"],
    mtable: [...(defaultSchema.attributes?.mtable ?? []), "columnalign", "rowspacing", "columnspacing"],
    mtd: [...(defaultSchema.attributes?.mtd ?? []), "columnalign"],
    mtr: [...(defaultSchema.attributes?.mtr ?? []), "rowalign"]
  },
  strip: [...(defaultSchema.strip ?? []), "script", "style"]
};
