import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

const DOCS_DIR = path.join(process.cwd(), 'src/docs_content');

export interface DocHeader {
    title: string;
    slug: string;
    level: number;
    children?: DocHeader[];
}

export function getSummary(): DocHeader[] {
    const summaryPath = path.join(DOCS_DIR, 'SUMMARY.md');
    if (!fs.existsSync(summaryPath)) return [];

    const content = fs.readFileSync(summaryPath, 'utf8');
    const lines = content.split('\n');
    const summary: DocHeader[] = [];
    let currentSection: DocHeader | null = null;

    for (const line of lines) {
        const sectionMatch = line.match(/^## (.+)/);
        if (sectionMatch) {
            currentSection = {
                title: sectionMatch[1],
                slug: '',
                level: 0,
                children: []
            };
            summary.push(currentSection);
            continue;
        }

        const linkMatch = line.match(/^(\s*)\* \[(.+)\]\((.+)\)/);
        if (linkMatch && currentSection) {
            const indent = linkMatch[1];
            const title = linkMatch[2];
            let slug = linkMatch[3].replace('.md', '');
            if (slug === 'README') slug = '';

            const level = indent.length / 2;
            currentSection.children?.push({ title, slug, level });
        }
    }

    return summary;
}

export function getDocContent(slug: string[]): string {
    let fileName = slug.join('/') || 'README';
    if (!fileName.endsWith('.md')) fileName += '.md';
    
    const filePath = path.join(DOCS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
        return '# Not Found\nThe requested documentation page could not be found.';
    }

    return fs.readFileSync(filePath, 'utf8');
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // remove non-word, non-space, non-hyphen
        .replace(/\s+/g, '-')     // replace spaces with hyphens
        .replace(/-+/g, '-')      // remove consecutive hyphens
        .trim();                 // trim start/end
}

export async function parseMarkdown(content: string): Promise<string> {
    const renderer = new marked.Renderer();
    
    // Add IDs to headings for anchor links
    renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
        const id = slugify(text);
        return `<h${depth} id="${id}">${text}</h${depth}>`;
    };

    // Transform relative .md links
    renderer.link = ({ href, text, title }: { href: string; text: string; title?: string | null }) => {
        let newHref = href;
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
            newHref = href.replace('.md', '');
            if (newHref === 'README') newHref = '';
            newHref = `/docs/${newHref}`;
        }
        return `<a href="${newHref}" title="${title || ''}">${text}</a>`;
    };

    return await marked.parse(content, { renderer });
}
