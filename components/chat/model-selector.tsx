"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODEL_OPTIONS, type LLMProvider } from "@/types";

interface ModelSelectorProps {
  selectedProvider: LLMProvider;
  selectedModel: string;
  availableProviders: string[];
  onSelect: (provider: LLMProvider, model: string) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI",
};

export function ModelSelector({
  selectedProvider,
  selectedModel,
  availableProviders,
  onSelect,
}: ModelSelectorProps) {
  const availableModels = MODEL_OPTIONS.filter((m) =>
    availableProviders.includes(m.provider)
  );

  // Group by provider
  const grouped = availableModels.reduce(
    (acc, model) => {
      if (!acc[model.provider]) acc[model.provider] = [];
      acc[model.provider].push(model);
      return acc;
    },
    {} as Record<string, typeof MODEL_OPTIONS>
  );

  function handleChange(value: string) {
    const [provider, model] = value.split("::") as [LLMProvider, string];
    onSelect(provider, model);
  }

  if (availableModels.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No models available. Add API keys in Settings.
      </div>
    );
  }

  return (
    <Select
      value={`${selectedProvider}::${selectedModel}`}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(grouped).map(([provider, models]) => (
          <SelectGroup key={provider}>
            <SelectLabel>{PROVIDER_LABELS[provider] ?? provider}</SelectLabel>
            {models.map((m) => (
              <SelectItem key={`${m.provider}::${m.model}`} value={`${m.provider}::${m.model}`}>
                {m.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
