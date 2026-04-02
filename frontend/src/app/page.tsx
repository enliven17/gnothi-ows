'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Header from './components/Header/Header';
import LandingView from './components/LandingView/LandingView';

export default function Home() {
  const router = useRouter();

  return (
    <>
      <Header 
        onNavigate={(page) => {
          if (page === 'markets') router.push('/markets');
          if (page === 'docs') router.push('/docs');
          if (page === 'landing') router.push('/');
        }} 
        currentPage="landing" 
      />
      <LandingView />
    </>
  );
}
