import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import TripPlannerPage from "./pages/TripPlannerPage";
import RoadTripPlannerPage from "./pages/RoadTripPlannerPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/plan" element={<TripPlannerPage />} />
        <Route path="/road-trip" element={<RoadTripPlannerPage />} />
      </Routes>
    </BrowserRouter>
  );
}
