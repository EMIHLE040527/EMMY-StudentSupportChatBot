import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// A small Markdown renderer for emmy's replies. Covers what the backend system
// prompt asks emmy to produce: paragraphs, bullet and numbered lists (nested),
// headings, bold/italic, inline code, fenced code, links, quotes, rules, and
// LaTeX maths ($...$ inline, $$...$$ display) typeset by KaTeX.
// Anything it doesn't recognise falls through as plain text.

const FENCE = /^ {0,3}```(\S*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*)$/;
const RULE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}>\s?(.*)$/;
const LIST_ITEM = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/;
const MATH_START = /^ {0,3}(\$\$|\\\[)/;

// Maths comes first so $a_1 + b_2$ can't be shredded by the italic rule, and
// inline code comes before that so `$5` stays literal. The $...$ arm requires
// non-space at both ends, which keeps "costs $5 and $10" out of the maths path.
const INLINE = new RegExp(
    [
        /`([^`]+)`/,                              // 1 code
        /\$\$([\s\S]+?)\$\$/,                     // 2 display maths
        /\$(?![\s$])([^$\n]*?[^\s$])\$/,          // 3 inline maths
        /\\\(([\s\S]+?)\\\)/,                     // 4 inline maths, \( \)
        /\*\*([\s\S]+?)\*\*/,                     // 5 bold
        /__([\s\S]+?)__/,                         // 6 bold
        /\*([^*\n]+)\*/,                          // 7 italic
        /_([^_\n]+)_/,                            // 8 italic
        /\[([^\]]+)\]\(([^)\s]+)\)/,              // 9 link text, 10 link url
    ]
        .map((r) => r.source)
        .join("|"),
    "g"
);


const indentOf = (line) => {
    const at = line.search(/\S/);
    return at === -1 ? 0 : at;
};


const isOrdered = (marker) => /\d/.test(marker);


function startsBlock(line) {
    return (
        FENCE.test(line) ||
        HEADING.test(line) ||
        RULE.test(line) ||
        QUOTE.test(line) ||
        LIST_ITEM.test(line) ||
        MATH_START.test(line)
    );
}


// Display maths on its own line, either $$ ... $$ or \[ ... \], on one line or
// spread over several.
function takeDisplayMath(lines, start) {

    const open = lines[start].trim().startsWith("$$") ? "$$" : "\\[";
    const close = open === "$$" ? "$$" : "\\]";

    const first = lines[start].trim().slice(open.length);
    const closesHere = first.indexOf(close);

    if (closesHere !== -1) {
        return [{ type: "math", tex: first.slice(0, closesHere).trim() }, start + 1];
    }

    const tex = [first];
    let i = start + 1;

    while (i < lines.length) {
        const at = lines[i].indexOf(close);
        if (at !== -1) {
            tex.push(lines[i].slice(0, at));
            i++;
            break;
        }
        tex.push(lines[i]);
        i++;
    }

    return [{ type: "math", tex: tex.join("\n").trim() }, i];
}


function nextNonBlank(lines, from) {
    for (let i = from; i < lines.length; i++) {
        if (lines[i].trim()) return i;
    }
    return -1;
}


function dedent(lines) {
    const filled = lines.filter((l) => l.trim());
    if (!filled.length) return lines;
    const shift = Math.min(...filled.map(indentOf));
    return lines.map((l) => l.slice(shift));
}


// Reads one list (all sibling items at the same indent) starting at `start`.
// Returns the block plus the line index to carry on from.
function takeList(lines, start) {

    const first = lines[start].match(LIST_ITEM);
    const indent = first[1].length;
    const ordered = isOrdered(first[2]);

    const items = [];
    let i = start;

    while (i < lines.length) {

        const item = lines[i].match(LIST_ITEM);
        if (!item || item[1].length !== indent || isOrdered(item[2]) !== ordered) break;

        const rest = [];
        i++;

        // Lines indented past the marker belong to this item: nested lists,
        // wrapped text, code under a step.
        while (i < lines.length) {

            if (!lines[i].trim()) {
                const following = nextNonBlank(lines, i);
                if (following === -1 || indentOf(lines[following]) <= indent) break;
                rest.push("");
                i++;
                continue;
            }

            if (indentOf(lines[i]) <= indent) break;
            rest.push(lines[i]);
            i++;
        }

        items.push(parseBlocks([item[3], ...dedent(rest)]));
    }

    const list = ordered
        ? { type: "ol", start: parseInt(first[2], 10), items }
        : { type: "ul", items };

    return [list, i];
}


export function parseBlocks(lines) {

    const blocks = [];
    let i = 0;

    while (i < lines.length) {

        const line = lines[i];

        if (!line.trim()) {
            i++;
            continue;
        }

        const fence = line.match(FENCE);
        if (fence) {
            const code = [];
            i++;
            while (i < lines.length && !FENCE.test(lines[i])) {
                code.push(lines[i]);
                i++;
            }
            i++;
            blocks.push({ type: "code", lang: fence[1], code: dedent(code).join("\n") });
            continue;
        }

        if (RULE.test(line)) {
            blocks.push({ type: "rule" });
            i++;
            continue;
        }

        if (MATH_START.test(line)) {
            const [math, resume] = takeDisplayMath(lines, i);
            blocks.push(math);
            i = resume;
            continue;
        }

        const heading = line.match(HEADING);
        if (heading) {
            blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
            i++;
            continue;
        }

        if (QUOTE.test(line)) {
            const quoted = [];
            while (i < lines.length && QUOTE.test(lines[i])) {
                quoted.push(lines[i].match(QUOTE)[1]);
                i++;
            }
            blocks.push({ type: "quote", blocks: parseBlocks(quoted) });
            continue;
        }

        if (LIST_ITEM.test(line)) {
            const [list, resume] = takeList(lines, i);
            blocks.push(list);
            i = resume;
            continue;
        }

        const paragraph = [];
        while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
            paragraph.push(lines[i].trim());
            i++;
        }
        blocks.push({ type: "p", text: paragraph.join("\n") });
    }

    return blocks;
}


function safeHref(url) {
    return /^(https?:|mailto:)/i.test(url) ? url : null;
}


// KaTeX escapes its input and `trust: false` (the default) blocks \href and raw
// HTML commands, so its output is safe to inject. If a formula won't parse we
// show the LaTeX source instead of KaTeX's red error text: a student can still
// read $\frac{a}{b}$, and it never breaks the thread.
function Formula({ tex, display }) {

    const html = useMemo(() => {
        try {
            return katex.renderToString(tex, {
                displayMode: Boolean(display),
                strict: false,
            });
        } catch {
            return null;
        }
    }, [tex, display]);

    if (html === null) {
        return <code className="math-raw">{tex}</code>;
    }

    const Tag = display ? "div" : "span";

    return (
        <Tag
            className={display ? "math-display" : "math-inline"}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}


function withBreaks(text, key) {
    return text.split("\n").flatMap((part, i) =>
        i === 0 ? [part] : [<br key={`${key}-br${i}`} />, part]
    );
}


function renderInline(text, key) {

    const nodes = [];
    let last = 0;

    // matchAll clones the regex, so the recursive calls below cannot clobber a
    // shared lastIndex the way exec() in a loop would.
    for (const match of text.matchAll(INLINE)) {

        if (match.index > last) {
            nodes.push(...withBreaks(text.slice(last, match.index), `${key}-t${last}`));
        }

        const [
            full,
            code,
            displayMath,
            inlineMath,
            parenMath,
            bold,
            boldAlt,
            italic,
            italicAlt,
            linkText,
            linkUrl,
        ] = match;

        const itemKey = `${key}-i${match.index}`;

        if (code !== undefined) {
            nodes.push(<code key={itemKey}>{code}</code>);
        } else if (displayMath !== undefined) {
            nodes.push(<Formula key={itemKey} tex={displayMath} display />);
        } else if (inlineMath !== undefined || parenMath !== undefined) {
            nodes.push(<Formula key={itemKey} tex={inlineMath ?? parenMath} />);
        } else if (bold !== undefined || boldAlt !== undefined) {
            // Recurse: emmy writes things like "**Identify $a$, $b$, $c$**", so
            // maths and code have to keep working inside a mark.
            nodes.push(<strong key={itemKey}>{renderInline(bold ?? boldAlt, itemKey)}</strong>);
        } else if (italic !== undefined || italicAlt !== undefined) {
            nodes.push(<em key={itemKey}>{renderInline(italic ?? italicAlt, itemKey)}</em>);
        } else {
            const href = safeHref(linkUrl);
            nodes.push(
                href ? (
                    <a key={itemKey} href={href} target="_blank" rel="noreferrer">
                        {renderInline(linkText, itemKey)}
                    </a>
                ) : (
                    linkText
                )
            );
        }

        last = match.index + full.length;
    }

    if (last < text.length) {
        nodes.push(...withBreaks(text.slice(last), `${key}-t${last}`));
    }

    return nodes;
}


function renderBlock(block, key) {

    switch (block.type) {

        case "p":
            return <p key={key}>{renderInline(block.text, key)}</p>;

        case "heading": {
            // The page h1 is the chat title, so a section inside a bubble starts at h3.
            const Tag = block.level <= 3 ? "h3" : "h4";
            return <Tag key={key}>{renderInline(block.text, key)}</Tag>;
        }

        case "ul":
            return <ul key={key}>{block.items.map((item, i) => renderItem(item, `${key}-${i}`))}</ul>;

        case "ol":
            return (
                <ol key={key} start={block.start}>
                    {block.items.map((item, i) => renderItem(item, `${key}-${i}`))}
                </ol>
            );

        case "code":
            return (
                <div className="code-block" key={key}>
                    {block.lang && <div className="code-lang">{block.lang}</div>}
                    <pre>
                        <code>{block.code}</code>
                    </pre>
                </div>
            );

        case "math":
            return <Formula key={key} tex={block.tex} display />;

        case "quote":
            return <blockquote key={key}>{renderBlocks(block.blocks, key)}</blockquote>;

        case "rule":
            return <hr key={key} />;

        default:
            return null;
    }
}


// A one-paragraph item sits straight in the <li> so it doesn't gain block spacing.
function renderItem(blocks, key) {

    if (blocks.length === 1 && blocks[0].type === "p") {
        return <li key={key}>{renderInline(blocks[0].text, key)}</li>;
    }

    return <li key={key}>{renderBlocks(blocks, key)}</li>;
}


function renderBlocks(blocks, key = "b") {
    return blocks.map((block, i) => renderBlock(block, `${key}-${i}`));
}


function Markdown({ text }) {

    const blocks = useMemo(
        () => parseBlocks(String(text ?? "").replace(/\r\n/g, "\n").split("\n")),
        [text]
    );

    return <div className="prose">{renderBlocks(blocks)}</div>;
}


export default Markdown;
