import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Auth is eager: it's the first thing an unauthenticated visitor needs, so
// code-splitting it would just add a round trip to the login screen. Every
// other page is lazy — each becomes its own chunk, so the initial download is
// the shell plus one page rather than the whole app (recharts, xlsx and all).
import AuthPage from "./pages/Auth";

const Index = lazy(() => import("./pages/Index"));
const SignupPage = lazy(() => import("./pages/Signup"));
const Members = lazy(() => import("./pages/Members"));
const MemberDetail = lazy(() => import("./pages/MemberDetail"));
const Receipt = lazy(() => import("./pages/Receipt"));
const Funds = lazy(() => import("./pages/Funds"));
const Income = lazy(() => import("./pages/Income"));
const Expenses = lazy(() => import("./pages/Expenses"));
const MemberTypes = lazy(() => import("./pages/MemberTypes"));
const Dues = lazy(() => import("./pages/Dues"));
const Meetings = lazy(() => import("./pages/Meetings"));
const DataExport = lazy(() => import("./pages/DataExport"));
const Users = lazy(() => import("./pages/Users"));
const BloodDonors = lazy(() => import("./pages/BloodDonors"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

/** Shown while a route's chunk is being fetched. Matches ProtectedRoute's own
 *  loading state so a cold navigation doesn't flash two different spinners. */
const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

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
              <Suspense fallback={<RouteFallback />}>
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
              </Suspense>
            </UnsavedChangesProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
