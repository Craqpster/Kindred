"use client";

import { useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, ChevronRight, Check } from "lucide-react";

export function PrivacySettings({ profile }: { profile: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [settings, setSettings] = useState({
    avatar_id: profile.avatar_id || "adventurer",
    display_name_mode: profile.display_name_mode || "username",
    dms_open: profile.dms_open ?? true,
    show_confidence: profile.show_confidence ?? true,
    show_interests: profile.show_interests ?? true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling accordion when clicking save
    setIsSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/profile/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error("Failed");
      setMessage("Saved!");
      setTimeout(() => setMessage(""), 2000);
    } catch (e) {
      setMessage("Error saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div 
        className="flex justify-between items-center mb-4 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400 group-hover:text-star-sapphire transition-colors" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-star-sapphire transition-colors" />
          )}
          <div>
            <h2 className="text-xl font-bold text-star-sapphire font-[var(--font-lora)] select-none">Privacy Options</h2>
            <p className="text-gray-600 text-sm select-none">Control your visibility</p>
          </div>
        </div>
        {isExpanded && (
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="text-metro-blue hover:text-star-sapphire text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="pl-7 animate-in slide-in-from-top-2 fade-in duration-200">
          {message && <p className="text-sm text-metro-blue mb-4">{message}</p>}

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div>
                <h3 className="font-medium text-ink text-sm">Avatar Style</h3>
                <p className="text-xs text-gray-500">Choose your Dicebear style</p>
              </div>
              
              <Select.Root 
                value={settings.avatar_id} 
                onValueChange={(val) => updateSetting("avatar_id", val)}
              >
                <Select.Trigger className="inline-flex items-center justify-between rounded-lg px-3 py-1.5 text-sm gap-2 bg-mist text-star-sapphire outline-none">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="h-4 w-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="overflow-hidden bg-white rounded-lg shadow-lg border border-gray-100 z-50">
                    <Select.Viewport className="p-1">
                      {[
                        { val: "adventurer", label: "Adventurer" },
                        { val: "avataaars", label: "Avataaars" },
                        { val: "bottts", label: "Bottts" },
                        { val: "fun-emoji", label: "Fun Emoji" },
                        { val: "identicon", label: "Identicon" },
                        { val: "lorelei", label: "Lorelei" },
                        { val: "notionists", label: "Notionists" },
                        { val: "open-peeps", label: "Open Peeps" },
                        { val: "pixel-art", label: "Pixel Art" }
                      ].map(style => (
                        <Select.Item key={style.val} value={style.val} className="relative flex items-center px-8 py-2 text-sm text-ink rounded-md select-none hover:bg-mist cursor-pointer outline-none">
                          <Select.ItemText>{style.label}</Select.ItemText>
                          <Select.ItemIndicator className="absolute left-2"><Check className="h-3 w-3 text-metro-blue" /></Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div>
                <h3 className="font-medium text-ink text-sm">Display Name Mode</h3>
                <p className="text-xs text-gray-500">Choose what name people see</p>
              </div>
              
              <Select.Root 
                value={settings.display_name_mode} 
                onValueChange={(val) => updateSetting("display_name_mode", val)}
              >
                <Select.Trigger className="inline-flex items-center justify-between rounded-lg px-3 py-1.5 text-sm gap-2 bg-mist text-star-sapphire outline-none">
                  <Select.Value />
                  <Select.Icon><ChevronDown className="h-4 w-4" /></Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="overflow-hidden bg-white rounded-lg shadow-lg border border-gray-100">
                    <Select.Viewport className="p-1">
                      <Select.Item value="username" className="relative flex items-center px-8 py-2 text-sm text-ink rounded-md select-none hover:bg-mist cursor-pointer outline-none">
                        <Select.ItemText>Username Only</Select.ItemText>
                        <Select.ItemIndicator className="absolute left-2"><Check className="h-3 w-3 text-metro-blue" /></Select.ItemIndicator>
                      </Select.Item>
                      <Select.Item value="real" className="relative flex items-center px-8 py-2 text-sm text-ink rounded-md select-none hover:bg-mist cursor-pointer outline-none">
                        <Select.ItemText>Real Name</Select.ItemText>
                        <Select.ItemIndicator className="absolute left-2"><Check className="h-3 w-3 text-metro-blue" /></Select.ItemIndicator>
                      </Select.Item>
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {[
              { id: "dms_open", label: "Open DMs", desc: "Allow anyone to send you a message" },
              { id: "show_confidence", label: "Show Confidence Tier", desc: "Display tier on your profile" },
              { id: "show_interests", label: "Show Interests", desc: "Make your hobbies public" }
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <h3 className="font-medium text-ink text-sm">{item.label}</h3>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                <Switch.Root
                  checked={settings[item.id as keyof typeof settings] as boolean}
                  onCheckedChange={(checked) => updateSetting(item.id, checked)}
                  className="w-[38px] h-[22px] bg-gray-200 rounded-full relative outline-none data-[state=checked]:bg-metro-blue transition-colors"
                >
                  <Switch.Thumb className="block w-[18px] h-[18px] bg-white rounded-full shadow transition-transform duration-100 translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
                </Switch.Root>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
