import React from 'react';
import { getSummary } from '../../lib/docs';
import styles from './Docs.module.css';
import { Sidebar } from './components/Sidebar';
import { DocsHeader } from './components/DocsHeader';

export default async function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const summary = getSummary();

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
            <DocsHeader />
            <div className={styles.container}>
                <Sidebar summary={summary} />
                <main className={styles.content}>
                    <div className={styles.markdown}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
