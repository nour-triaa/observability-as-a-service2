import { Routes, Route } from "react-router-dom";

import DashboardLayout from "./components/layout/DashboardLayout";

import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Metrics from "./pages/Metrics";
import Settings from "./pages/Settings";

import Login from "./pages/Login";
import Register from "./pages/Register";

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

    </Routes>
  );
}

export default App;
