'use client';

import { Settings, Wrench, AlertTriangle } from 'lucide-react';

interface MaintenanceScreenProps {
  reason: string;
}

export function MaintenanceScreen({ reason }: MaintenanceScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-6 overflow-hidden relative w-full">
      {/* Background gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div 
        className="relative z-10 flex flex-col items-center max-w-2xl text-center space-y-8 p-12 rounded-3xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700"
      >
        <div className="relative">
          <div
            className="absolute inset-0 flex items-center justify-center text-primary/30 blur-sm animate-[spin_8s_linear_infinite]"
          >
            <Settings size={120} />
          </div>
          <div
             className="relative z-10 text-primary animate-[spin_12s_linear_infinite_reverse]"
          >
            <Wrench size={80} />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
            System Maintenance
          </h1>
          <p className="text-xl text-zinc-400 font-medium max-w-lg mx-auto leading-relaxed">
            {reason || "We are currently undergoing scheduled upgrades to improve your experience. Please check back shortly."}
          </p>
        </div>

        <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-zinc-800/50 text-zinc-300 border border-zinc-700/50">
          <AlertTriangle className="text-yellow-500" size={20} />
          <span className="text-sm font-medium">Hogwarts CRM Infrastructure</span>
        </div>
      </div>
    </div>
  );
}
