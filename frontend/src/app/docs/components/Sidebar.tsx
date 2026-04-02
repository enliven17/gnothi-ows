'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DocHeader } from '../../../lib/docs';
import styles from '../Docs.module.css';

interface SidebarProps {
    summary: DocHeader[];
}

export const Sidebar: React.FC<SidebarProps> = ({ summary }) => {
    const pathname = usePathname();
    const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>(() => {
        // Initially expand sections that contain the active page
        const initial: Record<number, boolean> = {};
        summary.forEach((section, idx) => {
            const hasActiveChild = section.children?.some(item => {
                const slug = item.slug === '' ? '/docs' : `/docs/${item.slug.replace('.md', '')}`;
                return pathname === slug || (item.slug !== '' && pathname.includes(item.slug.replace('.md', '')));
            });
            initial[idx] = !!hasActiveChild || idx === 0; // Expand first section by default
        });
        return initial;
    });

    const toggleSection = (idx: number) => {
        setExpandedSections(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    const isActive = (slug: string) => {
        // Handle README/Default slug
        if (slug === '' && pathname === '/docs') return true;
        if (slug !== '' && pathname.includes(slug.replace('.md', ''))) return true;
        return false;
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.sidebarTitle}>Gnothi Docs</div>
            <nav className={styles.sidebarNav}>
                {summary.map((section, idx) => {
                    const isExpanded = expandedSections[idx];
                    return (
                        <div key={idx} className={styles.navSection}>
                            <h4 
                                className={styles.sectionTitle} 
                                onClick={() => toggleSection(idx)}
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                                {section.title}
                                <span style={{ 
                                    transition: 'transform 0.2s', 
                                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                    fontSize: '10px'
                                }}>▼</span>
                            </h4>
                            <div className={`${styles.sectionContent} ${isExpanded ? styles.sectionExpanded : styles.sectionCollapsed}`}>
                                {section.children && section.children.map((item, id) => {
                                    const href = item.slug === '' ? '/docs' : `/docs/${item.slug.replace('.md', '')}`;
                                    const isNested = item.level > 0;
                                    return (
                                        <div key={id} className={styles.navItem} style={{ paddingLeft: `${item.level * 16}px` }}>
                                            <Link 
                                                href={href}
                                                className={`${styles.navLink} ${isActive(item.slug) ? styles.activeNavLink : ''}`}
                                                style={{ fontSize: isNested ? '13px' : '14px' }}
                                            >
                                                {item.title}
                                            </Link>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
};
