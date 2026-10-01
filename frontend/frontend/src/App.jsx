
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateExpense from "./pages/CreateExpense";
import Expenses from "./pages/Expenses";

function App() {
  return (
    <BrowserRouter>

      <nav>
        <h2>Expense Approval System</h2>

        <div>
          <Link to="/">Login</Link>
          {" | "}
          <Link to="/dashboard">Dashboard</Link>
          {" | "}
          <Link to="/create-expense">Create Expense</Link>
          {" | "}
          <Link to="/expenses">Expenses</Link>
        </div>
      </nav>

      <hr />

      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/dashboard" element={<Dashboard />} />

        <Route
          path="/create-expense"
          element={<CreateExpense />}
        />

        <Route
          path="/expenses"
          element={<Expenses />}
        />
      </Routes>

    </BrowserRouter>
  );
}

export default App;

