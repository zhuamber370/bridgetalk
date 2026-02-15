import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const handleChangeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-[var(--color-text-muted)]" />
      <div className="flex items-center gap-1 bg-[var(--color-bg-secondary)] rounded-lg p-1">
        {languages.map((lang) => (
          <motion.button
            key={lang.code}
            onClick={() => handleChangeLanguage(lang.code)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
              currentLang === lang.code
                ? 'bg-white text-[var(--color-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            <span className="mr-1.5">{lang.flag}</span>
            {lang.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
