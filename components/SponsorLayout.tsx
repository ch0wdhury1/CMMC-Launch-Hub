import React from "react";
import { Activity, BarChart3, Building2, LayoutDashboard, LogOut, UserCircle } from "lucide-react";
import { APP_VERSION } from "../src/appVersion";

type SponsorView = "dashboard" | "participants" | "analytics" | "activity" | "profile";

type Props = {
  activeView: SponsorView;
  children: React.ReactNode;
  onNavigate: (view: SponsorView) => void;
  onLogout: () => void;
};

const navItems: Array<{ view: SponsorView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "participants", label: "Participants", icon: Building2 },
  { view: "analytics", label: "Program Analytics", icon: BarChart3 },
  { view: "activity", label: "Recent Activity", icon: Activity },
  { view: "profile", label: "My Profile", icon: UserCircle },
];

export const SponsorLayout: React.FC<Props> = ({ activeView, children, onNavigate, onLogout }) => (
  <div className="flex min-h-screen flex-col bg-gray-50">
    <header className="border-b border-blue-900 bg-blue-800 shadow-md">
      <div className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold leading-none text-white">CMMC Launch Hub</h1>
          <p className="mt-1 text-sm font-semibold text-blue-200">{APP_VERSION}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-2" aria-label="Sponsor Observer navigation">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.view)}
                className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ${active ? "bg-white text-blue-900" : "bg-blue-700 text-white hover:bg-blue-600"}`}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          <button type="button" onClick={onLogout} className="inline-flex items-center rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </button>
        </nav>
      </div>
    </header>
    <main className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-7xl">{children}</div>
    </main>
    <footer className="border-t bg-white px-6 py-3 text-xs text-gray-500">Sponsor Observer read-only oversight. Evidence files, raw notes, and remediation details are not exposed.</footer>
  </div>
);
