// src/App.jsx
import { Routes, Route } from "react-router-dom";

import DashboardLayout from "./components/layout/DashboardLayout";

import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Metrics from "./pages/Metrics";
import Settings from "./pages/Settings";
import VmDetails from "./pages/VmDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Nouveaux composants pour metrics
import KeyMetricsTable from "./components/metrics/KeyMetricsTable";
import EventTimeline from "./components/metrics/EventTimeline";

function App() {
  return (
    <Routes>
      {/* Authentication */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Dashboard pages */}
      <Route
        path="/dashboard"
        element={
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        }
      />
      <Route
        path="/clients"
        element={
          <DashboardLayout>
            <Clients />
          </DashboardLayout>
        }
      />
      <Route
        path="/metrics"
        element={
          <DashboardLayout>
            <Metrics />
            <h2>Key Metrics</h2>
            <KeyMetricsTable />

            <h2>Event Timeline</h2>
            <EventTimeline />
          </DashboardLayout>
        }
      />
      <Route
        path="/settings"
        element={
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        }
      />

      {/* Pages pour chaque VM */}
      <Route
        path="/vm/:name"
        element={
          <DashboardLayout>
            <VmDetails />
          </DashboardLayout>
        }
      />
    </Routes>
  );
}

export default App;
