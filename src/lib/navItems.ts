import {
  LayoutDashboard, Users, Wallet, ArrowDownCircle, ArrowUpCircle, Tags, Receipt, Droplet,
  FileSpreadsheet, CalendarClock, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

// Shared between the sidebar (AppLayout) and the command palette, so the two
// stay in sync automatically instead of carrying their own copy of the list.
export const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/members", label: "Members", icon: Users },
  { to: "/member-types", label: "Member Types", icon: Tags },
  { to: "/funds", label: "Funds", icon: Wallet },
  { to: "/income", label: "Income", icon: ArrowDownCircle },
  { to: "/expenses", label: "Expenses", icon: ArrowUpCircle },
  { to: "/dues", label: "Dues", icon: Receipt },
  { to: "/meetings", label: "Meetings", icon: CalendarClock },
  { to: "/export", label: "Export", icon: FileSpreadsheet },
  { to: "/blood-donors", label: "Blood Donors", icon: Droplet },
];
