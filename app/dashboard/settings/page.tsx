import { ApiKeyForm } from "@/components/settings/api-key-form";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your API keys and preferences
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">API Keys</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add your API keys to use different AI models. Keys are encrypted and
          stored securely. You need at least one key to use the chat feature.
        </p>
        <ApiKeyForm />
      </div>
    </div>
  );
}
