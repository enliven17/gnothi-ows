import { getDocContent, parseMarkdown } from '../../../lib/docs';

interface Props {
    params: Promise<{
        slug: string[];
    }>;
}

export default async function DocPage({ params }: Props) {
    const { slug } = await params;
    const content = getDocContent(slug);
    const html = await parseMarkdown(content);

    return (
        <div dangerouslySetInnerHTML={{ __html: html }} />
    );
}
