"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Settings, Database, Sliders, Shield, Download, RotateCcw, Save, Check } from "lucide-react";
import { useState } from "react";
import { resetAllStorage, getStudents, getTeachers, getClasses, getPayments, getAttendance, getNotifications } from "@/lib/storage";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<"general" | "academic" | "database">("general");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // General settings state
  const [centerName, setCenterName] = useState("TutorHub Academy");
  const [phone, setPhone] = useState("0987 654 321");
  const [email, setEmail] = useState("contact@tutorhub.edu.vn");
  const [timezone, setTimezone] = useState("GMT+7 (Asia/Ho_Chi_Minh)");

  // Academic settings state
  const [lessonDuration, setLessonDuration] = useState("90");
  const [maxStudents, setMaxStudents] = useState("15");
  const [gradingScale, setGradingScale] = useState("0-10");

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDatabase = async () => {
    if (confirm("WARNING: This will reset all modifications, delete newly added students/classes, and reload the page. Proceed?")) {
      await resetAllStorage();
    }
  };

  const handleExportBackup = async () => {
    const databaseBackup = {
      students: await getStudents(),
      teachers: await getTeachers(),
      classes: await getClasses(),
      payments: await getPayments(),
      attendance: await getAttendance(),
      notifications: await getNotifications(),
      exportedAt: new Date().toISOString(),
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(databaseBackup, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tutorhub_db_backup_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <PortalLayout role="admin" userName="Admin User" pageTitle="Cài đặt">
      <div className="space-y-6">
        <SectionHeader
          title="System Settings"
          subtitle="Configure system variables, academic thresholds, and local database backups"
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tab Selection Navigation */}
          <Card className="lg:col-span-1 border border-border h-fit">
            <CardContent className="p-2 space-y-1">
              {[
                { id: "general" as const, label: "General Settings", icon: Settings },
                { id: "academic" as const, label: "Academic Settings", icon: Sliders },
                { id: "database" as const, label: "Database & Backups", icon: Database },
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center gap-2.5 font-semibold text-xs uppercase tracking-wider ${
                      activeTab === tab.id
                        ? "bg-rose-500 text-white shadow-md"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {tab.label}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Active Tab Panel */}
          <Card className="lg:col-span-3 border border-border">
            <CardHeader className="pb-3 border-b border-border bg-muted/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2 capitalize">
                {activeTab === "general" && <Settings className="h-4 w-4 text-rose-500" />}
                {activeTab === "academic" && <Sliders className="h-4 w-4 text-rose-500" />}
                {activeTab === "database" && <Database className="h-4 w-4 text-rose-500" />}
                {activeTab} Configurations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {activeTab === "general" && (
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Academy Name *</label>
                      <Input
                        required
                        value={centerName}
                        onChange={e => setCenterName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Phone Number</label>
                      <Input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Contact Email</label>
                      <Input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">System Timezone</label>
                      <Input
                        value={timezone}
                        onChange={e => setTimezone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-border mt-6 items-center gap-3">
                    {saveSuccess && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="h-4 w-4" /> Saved Successfully!
                      </span>
                    )}
                    <Button type="submit" variant="gradient" className="flex items-center gap-1.5 font-bold">
                      <Save className="h-4 w-4" /> Save Configurations
                    </Button>
                  </div>
                </form>
              )}

              {activeTab === "academic" && (
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Default Lesson Duration (mins)</label>
                      <Input
                        type="number"
                        value={lessonDuration}
                        onChange={e => setLessonDuration(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Max Students Per Class</label>
                      <Input
                        type="number"
                        value={maxStudents}
                        onChange={e => setMaxStudents(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Grading Scale System</label>
                      <select
                        className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none"
                        value={gradingScale}
                        onChange={e => setGradingScale(e.target.value)}
                      >
                        <option value="0-10">Decimal Scale (0-10)</option>
                        <option value="A-F">Letter Grades (A-F)</option>
                        <option value="0-100">Percentage Scale (0-100)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-border mt-6 items-center gap-3">
                    {saveSuccess && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="h-4 w-4" /> Saved Successfully!
                      </span>
                    )}
                    <Button type="submit" variant="gradient" className="flex items-center gap-1.5 font-bold">
                      <Save className="h-4 w-4" /> Save Configurations
                    </Button>
                  </div>
                </form>
              )}

              {activeTab === "database" && (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-950 bg-rose-50/50 dark:bg-rose-950/10 flex items-start gap-3">
                    <Shield className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-foreground">Local Development Mode</p>
                      <p className="text-muted-foreground leading-relaxed">
                        TutorHub currently operates in client-side mockup mode. All actions (adding/deleting students, logging classes, checking attendance) are persisted in your web browser&apos;s localStorage cache. You can reset it to original mock records or export database state.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <Card className="border border-border hover:bg-muted/10 transition-all">
                      <CardContent className="p-4 space-y-3">
                        <div className="space-y-1">
                          <h6 className="text-sm font-bold text-foreground">Database Backup</h6>
                          <p className="text-xs text-muted-foreground">Download the entire mock registry as a local JSON file.</p>
                        </div>
                        <Button type="button" variant="outline" className="w-full flex items-center justify-center gap-1.5 font-semibold" onClick={handleExportBackup}>
                          <Download className="h-4 w-4 text-rose-500" /> Export DB Backup
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border border-border hover:bg-muted/10 transition-all">
                      <CardContent className="p-4 space-y-3">
                        <div className="space-y-1">
                          <h6 className="text-sm font-bold text-foreground">Reset Storage Cache</h6>
                          <p className="text-xs text-muted-foreground">Delete all browser cache databases and restore starting state.</p>
                        </div>
                        <Button type="button" variant="outline" className="w-full flex items-center justify-center gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold" onClick={handleResetDatabase}>
                          <RotateCcw className="h-4 w-4" /> Reset Mock Database
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
