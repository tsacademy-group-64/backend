
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import "./App.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CreateExpense from "./pages/CreateExpense";
import Expenses from "./pages/Expenses";
import ManagerExpenses from "./pages/ManagerExpenses";
import ProtectedRoute from "./ProtectedRoute";

function Navigation() {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    alert("You have been logged out");

    navigate("/");
  };

  return (
    <nav className="navbar">
      <h2>Expense Approval System</h2>

      <div className="nav-links">
        {token && user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>

            {user.role === "employee" && (
              <Link to="/create-expense">Create Expense</Link>
            )}

            <Link to="/expenses">Expenses</Link>

            {user.role === "manager" && (
              <Link to="/manager-expenses">
                Manager Approval
              </Link>
            )}

            <button
              className="logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/">Login</Link>
            <Link to="/register">Create Account</Link>
          </>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navigation />

      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-expense"
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <CreateExpense />
            </ProtectedRoute>
          }
        />

        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <Expenses />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager-expenses"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <ManagerExpenses />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;



