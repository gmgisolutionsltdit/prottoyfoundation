import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import SignupPage from "./pages/Signup";

import Members from "./pages/Members";
import MemberDetail from "./pages/MemberDetail";
import Receipt from "./pages/Receipt";
import Funds from "./pages/Funds";
import Income from "./pages/Income";
import Expenses from "./pages/Expenses";
import MemberTypes from "./pages/MemberTypes";
import Dues from "./pages/Dues";
import Meetings from "./pages/Meetings";
import DataExport from "./pages/DataExport";
import Users from "./pages/Users";
import BloodDonors from "./pages/BloodDonors";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  // Manual-only for now (no enableSystem) — the dark CSS variables in
  // index.css haven't had a full page-by-page pass yet, so flipping every
  // OS-dark visitor into dark mode automatically before that pass is done
  // would ship a half-finished look. A toggle turns it on deliberately.
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <UnsavedChangesProvider>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/signup" element={<SignupPage />} />

                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
                <Route path="/members/:id" element={<ProtectedRoute><MemberDetail /></ProtectedRoute>} />
                <Route path="/receipt/:id" element={<ProtectedRoute><Receipt /></ProtectedRoute>} />
                <Route path="/funds" element={<ProtectedRoute><Funds /></ProtectedRoute>} />
                <Route path="/income" element={<ProtectedRoute><Income /></ProtectedRoute>} />
                <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
                <Route path="/member-types" element={<ProtectedRoute><MemberTypes /></ProtectedRoute>} />
                <Route path="/dues" element={<ProtectedRoute><Dues /></ProtectedRoute>} />
                <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
                <Route path="/export" element={<ProtectedRoute><DataExport /></ProtectedRoute>} />

                <Route path="/blood-donors" element={<ProtectedRoute><BloodDonors /></ProtectedRoute>} />
                <Route
                  path="/users"
                  element={<ProtectedRoute requireSuperAdmin><Users /></ProtectedRoute>}
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </UnsavedChangesProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
