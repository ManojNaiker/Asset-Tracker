import { Moon, Sun, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 text-slate-400 hover:text-white hover:bg-slate-800 no-default-hover-elevate shrink-0"
        >
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("amazon-green")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-emerald-600" />
          <span>Amazon Green</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("ocean-blue")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-blue-600" />
          <span>Ocean Blue</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("sunset-orange")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-orange-500" />
          <span>Sunset Orange</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("royal-purple")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-purple-500" />
          <span>Royal Purple</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
