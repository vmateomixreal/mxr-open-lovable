"use client";

import { useState } from "react";
import Link from "next/link";
import { appConfig } from "@/config/app.config";

interface SidebarInputProps {
  onSubmit: (url: string, style: string, model: string, instructions?: string) => void;
  disabled?: boolean;
}

export default function SidebarInput({ onSubmit, disabled = false }: SidebarInputProps) {
  const [url, setUrl] = useState<string>("");
  const [selectedStyle, setSelectedStyle] = useState<string>("1");
  const [selectedModel, setSelectedModel] = useState<string>(appConfig.ai.defaultModel);
  const [additionalInstructions, setAdditionalInstructions] = useState<string>("");
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);

  // Simple URL validation - currently unused but keeping for future use
  // const validateUrl = (urlString: string) => {
  //   if (!urlString) return false;
  //   const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  //   return urlPattern.test(urlString.toLowerCase());
  // };

  const styles = [
    { id: "1", name: "Glassmorphism", description: "Efecto cristal esmerilado" },
    { id: "2", name: "Neumorphism", description: "Sombras 3D suaves" },
    { id: "3", name: "Brutalism", description: "Audaz y crudo" },
    { id: "4", name: "Minimalist", description: "Limpio y simple" },
    { id: "5", name: "Dark Mode", description: "Diseño en tema oscuro" },
    { id: "6", name: "Gradient Rich", description: "Degradados intensos" },
    { id: "7", name: "3D Depth", description: "Capas dimensionales" },
    { id: "8", name: "Retro Wave", description: "Inspirado en los 80" },
  ];

  const models = appConfig.ai.availableModels.map(model => ({
    id: model,
    name: appConfig.ai.modelDisplayNames[model] || model,
  }));

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim() || disabled) return;

    onSubmit(url.trim(), selectedStyle, selectedModel, additionalInstructions || undefined);

    // Reset form
    setUrl("");
    setAdditionalInstructions("");
    setIsValidUrl(false);
  };

  return (
    <div className="w-full">
      <div >
        <div className="p-4 border-b border-gray-100">
         {/* link to home page with button */}
         <Link href="/">
          <button className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white rounded border border-gray-200 focus:border-[var(--mx-menu)] focus:outline-none focus:ring-1 focus:ring-[var(--mx-menu)]">
            Generar un sitio nuevo
          </button>
         </Link>
        </div>

        {/* Options Section - Show when valid URL */}
        {isValidUrl && (
          <div className="p-4 space-y-4">
            {/* Style Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Estilo</label>
              <div className="grid grid-cols-2 gap-1.5">
                {styles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    disabled={disabled}
                    className={`
                      py-2 px-2 rounded text-xs font-medium border transition-all text-center
                      ${selectedStyle === style.id
                        ? 'border-[var(--mx-menu)] bg-[var(--mxr-blue-soft)] text-[var(--mx-menu)]'
                        : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selector */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Modelo de IA</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white rounded border border-gray-200 focus:border-[var(--mx-menu)] focus:outline-none focus:ring-1 focus:ring-[var(--mx-menu)]"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Additional Instructions */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Instrucciones adicionales (opcional)</label>
              <input
                type="text"
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 text-xs text-gray-700 bg-gray-50 rounded border border-gray-200 focus:border-[var(--mx-menu)] focus:outline-none focus:ring-1 focus:ring-[var(--mx-menu)] placeholder:text-gray-400"
                placeholder="p. ej., hazlo más colorido, añade animaciones..."
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={!isValidUrl || disabled}
                className={`
                  w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all
                  ${isValidUrl && !disabled
                    ? 'bg-[var(--mx-menu)] hover:opacity-90 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {disabled ? 'Extrayendo...' : 'Extraer sitio'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}