import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TripPlannerPage from "./pages/TripPlannerPage";
import RoadTripPlannerPage from "./pages/RoadTripPlannerPage";
import SavedTripsPage from "./pages/SavedTripsPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/plan" element={<TripPlannerPage />} />
        <Route path="/road-trip" element={<RoadTripPlannerPage />} />
        <Route path="/saved" element={<SavedTripsPage />} />
        <Route path="/destinations" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
