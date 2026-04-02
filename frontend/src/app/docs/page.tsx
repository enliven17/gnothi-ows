import { getDocContent, parseMarkdown } from '../../lib/docs';

export default async function DocsPage() {
    const content = getDocContent([]);
    const html = await parseMarkdown(content);

    return (
        <div dangerouslySetInnerHTML={{ __html: html }} />
    );
}
