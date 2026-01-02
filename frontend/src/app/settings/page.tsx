import SettingsPanel from "@/components/SettingsPanel";

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-white/40 text-sm">Configure bot parameters and strategies</p>
      </div>
      <SettingsPanel />
    </div>
  );
}
