import { Routes, Route } from "react-router-dom";

// Layout
import DashboardLayout from "./components/layout/DashboardLayout";

// Pages
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Metrics from "./pages/Metrics";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VmDetails from "./pages/VmDetails"; // Page dédiée aux metrics par VM

// Graphs et composants métriques (Dashboard + VmDetails)
import CpuGraph from "./components/metrics/CpuGraph";
import CpuReadyGraph from "./components/metrics/CpuReadyGraph";
import DiskUsage from "./components/metrics/DiskUsage";
import PowerStatus from "./components/metrics/PowerStatus";
import VmToolsStatus from "./components/metrics/VmToolsStatus";
import NetworkGraph from "./components/metrics/NetworkGraph";
import LatencyGraph from "./components/metrics/LatencyGraph";

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

      {/* Page dédiée à chaque VM */}
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
