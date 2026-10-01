
import { useEffect, useState } from "react";

function Dashboard() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user"));

  const fetchExpenses = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:5000/api/expenses",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      console.log("Dashboard expenses:", result);

      if (!response.ok) {
        alert(result.message || "Failed to get expenses");
        return;
      }

      setExpenses(result.data.expenses);
    } catch (error) {
      console.error("Dashboard error:", error);
      alert("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <h2>Loading dashboard...</h2>
      </div>
    );
  }

  const totalExpenses = expenses.length;

  const totalAmount = expenses.reduce(
    (total, expense) => total + Number(expense.amount),
    0
  );

  const pendingExpenses = expenses.filter(
    (expense) => expense.status === "pending"
  ).length;

  const approvedExpenses = expenses.filter(
    (expense) => expense.status === "approved"
  ).length;

  const rejectedExpenses = expenses.filter(
    (expense) => expense.status === "rejected"
  ).length;

  return (
    <div className="page-container">
      {/* Welcome Section */}

      <div className="card" style={{ marginBottom: "25px" }}>
        <h1>Dashboard</h1>

        {user && (
          <>
            <h2>Welcome, {user.name} 👋</h2>

            <p>
              <strong>Email:</strong> {user.email}
            </p>

            <p>
              <strong>Role:</strong>{" "}
              <span style={{ textTransform: "capitalize" }}>
                {user.role}
              </span>
            </p>
          </>
        )}
      </div>

      {/* Summary */}

      <h2>
        {user?.role === "employee"
          ? "My Expense Summary"
          : "Expense Approval Summary"}
      </h2>

      <p style={{ color: "#666", marginBottom: "25px" }}>
        {user?.role === "employee"
          ? "Here is a summary of your submitted expenses."
          : "Here is a summary of expenses submitted by employees."}
      </p>

      {/* Dashboard Cards */}

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <h3>Total Expenses</h3>
          <p>{totalExpenses}</p>
        </div>

        <div className="dashboard-card">
          <h3>Total Amount</h3>
          <p>
            ₦{totalAmount.toLocaleString("en-NG")}
          </p>
        </div>

        <div className="dashboard-card">
          <h3>Pending</h3>
          <p>{pendingExpenses}</p>
        </div>

        <div className="dashboard-card">
          <h3>Approved</h3>
          <p>{approvedExpenses}</p>
        </div>

        <div className="dashboard-card">
          <h3>Rejected</h3>
          <p>{rejectedExpenses}</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;


