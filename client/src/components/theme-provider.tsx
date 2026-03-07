import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "amazon-green" | "ocean-blue" | "sunset-orange" | "royal-purple";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark", "amazon-green", "ocean-blue", "sunset-orange", "royal-purple");

    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "amazon-green") {
      root.classList.add("amazon-green");
    } else if (theme === "ocean-blue") {
      root.classList.add("ocean-blue");
    } else if (theme === "sunset-orange") {
      root.classList.add("sunset-orange");
    } else if (theme === "royal-purple") {
      root.classList.add("royal-purple");
    } else {
      root.classList.add("light");
    }
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
}
