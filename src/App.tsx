import React from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Footer } from './components/Footer';
import { BacktestProvider } from './context/BacktestContext';

function App() {
  return (
    <BacktestProvider>
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Dashboard />
        </main>
        <Footer />
      </div>
    </BacktestProvider>
  );
}

export default App;