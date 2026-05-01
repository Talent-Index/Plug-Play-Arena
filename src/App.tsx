import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlayerProvider } from "@/lib/playerContext";
import HomePage from "./pages/HomePage";
import OnboardingPage from "./pages/OnboardingPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import GameLibraryPage from "./pages/GameLibraryPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import RewardsPage from "./pages/RewardsPage";
import MyJourneyPage from "./pages/MyJourneyPage";
import ProfilePage from "./pages/ProfilePage";
import MissionPlayPage from "./pages/MissionPlayPage";
import ChallengePage from "./pages/ChallengePage";
import AuthPage from "./pages/AuthPage";
import QuestsPage from "./pages/QuestsPage";
import NotFound from "./pages/NotFound";
import AvalancheArenaIntro from "./pages/avalanche-arena/AvalancheArenaIntro";
import AvalancheArenaLobby from "./pages/avalanche-arena/AvalancheArenaLobby";
import AvalancheArenaPlay from "./pages/avalanche-arena/AvalancheArenaPlay";
import AvalancheArenaResults from "./pages/avalanche-arena/AvalancheArenaResults";
import ArenaHostPage from "./pages/ArenaHostPage";
import ArenaJoinPage from "./pages/ArenaJoinPage";
import ArenaPlayerPage from "./pages/ArenaPlayerPage";
import ArenaLayout from "./pages/ArenaLayout";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminGames from "./pages/admin/AdminGames";
import AdminChallenges from "./pages/admin/AdminChallenges";
import AdminPlayers from "./pages/admin/AdminPlayers";
import AdminArena from "./pages/admin/AdminArena";
import AdminSubmissions from "./pages/admin/AdminSubmissions";
import AdminNFTs from "./pages/admin/AdminNFTs";
import AdminSettings from "./pages/admin/AdminSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PlayerProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/library" element={<GameLibraryPage />} />
            <Route path="/play/:gameId" element={<MissionPlayPage />} />
            <Route path="/challenge/:slug" element={<ChallengePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/quests" element={<QuestsPage />} />
            <Route path="/journey" element={<MyJourneyPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/games" element={<GameLibraryPage />} />
            <Route path="/games/avalanche-arena" element={<AvalancheArenaIntro />} />
            <Route path="/games/avalanche-arena/lobby" element={<AvalancheArenaLobby />} />
            <Route path="/games/avalanche-arena/play" element={<AvalancheArenaPlay />} />
            <Route path="/games/avalanche-arena/results" element={<AvalancheArenaResults />} />
            <Route path="/arena" element={<ArenaLayout />}>
              <Route index element={<ArenaHostPage />} />
              <Route path="join/:code?" element={<ArenaJoinPage />} />
              <Route path="play" element={<ArenaPlayerPage />} />
            </Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="games" element={<AdminGames />} />
              <Route path="challenges" element={<AdminChallenges />} />
              <Route path="players" element={<AdminPlayers />} />
              <Route path="arena" element={<AdminArena />} />
              <Route path="submissions" element={<AdminSubmissions />} />
              <Route path="nfts" element={<AdminNFTs />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PlayerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
