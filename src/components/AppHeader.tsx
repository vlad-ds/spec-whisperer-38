import { Link, useLocation } from "react-router-dom";
import { 
  Upload, 
  FileText, 
  BarChart3, 
  BookOpen, 
  MessageSquare 
} from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "Upload", icon: Upload },
  { to: "/contracts", label: "Contracts", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/regulatory-digest", label: "Digest", icon: BookOpen },
  { to: "/regchat", label: "RegChat", icon: MessageSquare },
];

const NavItem = ({ 
  to, 
  label, 
  icon: Icon, 
  isActive 
}: { 
  to: string; 
  label: string; 
  icon: React.ElementType; 
  isActive: boolean;
}) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
      isActive 
        ? "bg-primary/10 text-primary" 
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    )}
  >
    <Icon className="h-4 w-4" />
    <span className="hidden sm:inline">{label}</span>
  </Link>
);

export const AppHeader = () => {
  const location = useLocation();

  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-foreground">
          ComplyFlow
        </Link>
        <nav className="flex items-center gap-1">
          {navLinks.map(({ to, label, icon }) => (
            <NavItem
              key={to}
              to={to}
              label={label}
              icon={icon}
              isActive={location.pathname === to}
            />
          ))}
        </nav>
      </div>
    </header>
  );
};
