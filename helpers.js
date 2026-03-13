import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import AppLayout from './components/AppLayout'
import DashboardPage from './pages/DashboardPage'
import AlatnicaPage from './pages/AlatnicaPage'
import StegePage from './pages/StegePage'
import MaterialsPage from './pages/MaterialsPage'
import FixturesPage from './pages/FixturesPage'
import MachinesPage from './pages/MachinesPage'
import LocationsPage from './pages/LocationsPage'
import UsageTrackingPage from './pages/UsageTrackingPage'
import AIInsightsPage from './pages/AIInsightsPage'
import AIChatPage from './pages/AIChatPage'
import OEEPage from './pages/OEEPage'
import GCodePage from './pages/GCodePage'
import AISchedulePage from './pages/AISchedulePage'
import MachineTelemetryPage from './pages/MachineTelemetryPage'
import FormsPage from './pages/FormsPage'
import MachineMaintPage from './pages/MachineMaintPage'
import DigitalTwinPage from './pages/DigitalTwinPage'
import SalesPage from './pages/SalesPage'
import QualityPage from './pages/QualityPage'
import WarehousePage from './pages/WarehousePage'
import HRPage from './pages/HRPage'
import DMSPage from './pages/DMSPage'
import KPIPage from './pages/KPIPage'
import KalkulacijePage from './pages/KalkulacijePage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import OEEMonitoringPage from './pages/OEEMonitoringPage'
import ToolLifePage from './pages/ToolLifePage'
import ProductionPlanningPage from './pages/ProductionPlanningPage'
import KontrolingPage from './pages/KontrolingPage'
import TasksPage from './pages/TasksPage'
import UserManagementPage from './pages/UserManagementPage'
import CAMGeneratorPage from './pages/CAMGeneratorPage'

function Private({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace/>
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace/> : <LoginPage/>}/>
      <Route path="/" element={<Private><AppLayout/></Private>}>
        <Route index element={<DashboardPage/>}/>
        <Route path="sales" element={<SalesPage/>}/>
        <Route path="quality" element={<QualityPage/>}/>
        <Route path="warehouse" element={<WarehousePage/>}/>
        <Route path="hr" element={<HRPage/>}/>
        <Route path="dms" element={<DMSPage/>}/>
        <Route path="kpi" element={<KPIPage/>}/>
        <Route path="kalkulacije" element={<KalkulacijePage/>}/>
        <Route path="work-orders" element={<WorkOrdersPage/>}/>
        <Route path="oee-monitoring" element={<OEEMonitoringPage/>}/>
        <Route path="tool-life" element={<ToolLifePage/>}/>
        <Route path="production-planning" element={<ProductionPlanningPage/>}/>
        <Route path="kontroling" element={<KontrolingPage/>}/>
        <Route path="tasks" element={<TasksPage/>}/>
        <Route path="user-management" element={<UserManagementPage/>}/>
        <Route path="fixtures" element={<FixturesPage/>}/>
        <Route path="usage" element={<UsageTrackingPage/>}/>
        <Route path="machines" element={<MachinesPage/>}/>
        <Route path="locations" element={<LocationsPage/>}/>
        <Route path="alatnica" element={<AlatnicaPage/>}/>
        <Route path="stege" element={<StegePage/>}/>
        <Route path="materijali" element={<MaterialsPage/>}/>
        <Route path="ai-insights" element={<AIInsightsPage/>}/>
        <Route path="ai-chat" element={<AIChatPage/>}/>
        <Route path="oee" element={<OEEPage/>}/>
        <Route path="gcode" element={<GCodePage/>}/>
        <Route path="ai-schedule" element={<AISchedulePage/>}/>
        <Route path="machines-live" element={<MachineTelemetryPage/>}/>
        <Route path="digital-twin" element={<DigitalTwinPage/>}/>
        <Route path="forms" element={<FormsPage/>}/>
        <Route path="machine-maintenance" element={<MachineMaintPage/>}/>
        <Route path="cam" element={<CAMGeneratorPage/>}/>
      </Route>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  )
}
