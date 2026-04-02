'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header/Header';

export const DocsHeader: React.FC = () => {
    const router = useRouter();

    return (
        <Header 
            onNavigate={(page) => {
                if (page === 'landing') router.push('/');
                if (page === 'markets') router.push('/markets');
                if (page === 'docs') router.push('/docs');
            }} 
            currentPage="docs" 
        />
    );
};
