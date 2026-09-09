import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, User } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut,
} from "@/components/ui/command";
import { navItems } from "@/lib/navItems";
import { useAuth } from "@/hooks/useAuth";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { supabase } from "@/integrations/supabase/client";

interface MemberHit {
  id: string;
  full_name: string;
  member_no: number;
}

/** Global Cmd/Ctrl+K palette: jump to any page, or jump to a member by name/number.
 * Open state is controlled by the caller (AppLayout) so a visible top-bar
 * button can open it too, not just the keyboard shortcut. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [members, setMembers] = useState<MemberHit[] | null>(null);
  const { isSuperAdmin } = useAuth();
  const { confirmLeave, setDirty } = useUnsavedChanges();
  const navigate = useNavigate();

  // Members fetched lazily, once, the first time the palette is opened —
  // no need to load the list for every page view.
  useEffect(() => {
    if (!open || members !== null) return;
    supabase
      .from("members")
      .select("id, full_name, member_no")
      .order("member_no")
      .then(({ data }) => setMembers(data ?? []));
  }, [open, members]);

  function go(to: string) {
    if (!confirmLeave()) return;
    setDirty(false);
    onOpenChange(false);
    navigate(to);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a page, or search a member…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {navItems.map((item) => (
            <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
          {isSuperAdmin && (
            <CommandItem value="Users" onSelect={() => go("/users")}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Users
            </CommandItem>
          )}
        </CommandGroup>
        {members && members.length > 0 && (
          <CommandGroup heading="Members">
            {members.map((m) => (
              <CommandItem
                key={m.id}
                value={`${m.member_no} ${m.full_name}`}
                onSelect={() => go(`/members/${m.id}`)}
              >
                <User className="mr-2 h-4 w-4" />
                <span className="truncate">{m.full_name}</span>
                <CommandShortcut>#{m.member_no}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
