
import { useEffect, useState } from "react";

function ManagerExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please login first");
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

      console.log("Manager expenses:", result);

      if (!response.ok) {
        alert(result.message || "Failed to get expenses");
        return;
      }

      setExpenses(result.data.expenses);
    } catch (error) {
      console.error("Get expenses error:", error);
      alert("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const approveExpense = async (id) => {
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(
        `http://localhost:5000/api/expenses/${id}/approve`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "Failed to approve expense");
        return;
      }

      alert("Expense approved successfully!");

      fetchExpenses();
    } catch (error) {
      console.error("Approve error:", error);
      alert("Unable to connect to server");
    }
  };

  const rejectExpense = async (id) => {
    const token = localStorage.getItem("token");

    const reason = prompt(
      "Enter reason for rejecting this expense:"
    );

    if (!reason) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/expenses/${id}/reject`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rejectionReason: reason,
          }),
        }
      );

      const result = await response.json();
if (!response.ok) {
  console.log(
  "REJECT VALIDATION ERRORS:",
  result.data?.errors
);
  alert(result.message || "Failed to reject expense");
  return;
}

      alert("Expense rejected successfully!");

      fetchExpenses();
    } catch (error) {
      console.error("Reject error:", error);
      alert("Unable to connect to server");
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <h2>Loading expenses...</h2>
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
      {/* Page Header */}

      <div style={{ marginBottom: "30px" }}>
        <h1>Manager - Expense Approval</h1>

        <p style={{ color: "#666" }}>
          Review and manage employee expense requests.
        </p>
      </div>

      {/* Summary */}

      <h2>Expense Summary</h2>

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

      {/* Expenses */}

      <div style={{ marginTop: "40px" }}>
        <h2>Expenses Awaiting Review</h2>

        <p style={{ color: "#666", marginBottom: "25px" }}>
          Review each employee expense and approve or reject
          pending requests.
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="card">
          <h2>No expenses available</h2>

          <p style={{ color: "#666" }}>
            There are currently no expense requests to review.
          </p>
        </div>
      ) : (
        <div>
          {expenses.map((expense) => (
            <div className="expense-card" key={expense._id}>
              {/* Expense Header */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "15px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2>{expense.title}</h2>

                  <p
                    style={{
                      color: "#2563eb",
                      fontWeight: "bold",
                    }}
                  >
                    {expense.category}
                  </p>
                </div>

                <span
                  className={`status status-${expense.status}`}
                >
                  {expense.status}
                </span>
              </div>

              <hr />

              {/* Employee */}

              <div
                style={{
                  background: "#eff6ff",
                  padding: "15px",
                  borderRadius: "8px",
                  marginBottom: "20px",
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  Employee Information
                </h3>

                <p>
                  <strong>Name:</strong>{" "}
                  {expense.submittedBy?.name || "Unknown"}
                </p>

                <p style={{ marginBottom: 0 }}>
                  <strong>Email:</strong>{" "}
                  {expense.submittedBy?.email || "Unknown"}
                </p>
              </div>

              {/* Expense Details */}

              <p>
                <strong>Amount:</strong>{" "}
                <span style={{ fontSize: "20px" }}>
                  ₦{Number(expense.amount).toLocaleString("en-NG")}
                </span>
              </p>

              <p>
                <strong>Date:</strong>{" "}
                {new Date(
                  expense.expenseDate
                ).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>

              <p>
                <strong>Description:</strong>{" "}
                {expense.description || "No description"}
              </p>

              <p>
                <strong>Receipt:</strong>{" "}
                {expense.receiptDetails ||
                  "No receipt details"}
              </p>

              {/* Rejection Reason */}

              {expense.status === "rejected" && (
                <div
                  style={{
                    background: "#fee2e2",
                    padding: "15px",
                    borderRadius: "8px",
                    marginTop: "20px",
                  }}
                >
                  <strong>Rejection Reason:</strong>

                  <p style={{ marginBottom: 0 }}>
                    {expense.rejectionReason ||
                      "No reason provided"}
                  </p>
                </div>
              )}

              {/* Approval Buttons */}

              {expense.status === "pending" && (
                <div
                  style={{
                    background: "#fef3c7",
                    padding: "20px",
                    borderRadius: "8px",
                    marginTop: "20px",
                  }}
                >
                  <p style={{ marginTop: 0 }}>
                    <strong>
                      This expense is waiting for your
                      approval.
                    </strong>
                  </p>

                  <button
                    className="button success-button"
                    onClick={() =>
                      approveExpense(expense._id)
                    }
                  >
                    ✓ Approve Expense
                  </button>

                  {" "}

                  <button
                    className="button danger-button"
                    onClick={() =>
                      rejectExpense(expense._id)
                    }
                  >
                    ✕ Reject Expense
                  </button>
                </div>
              )}

              {/* Approved Message */}

              {expense.status === "approved" && (
                <div
                  style={{
                    background: "#dcfce7",
                    padding: "15px",
                    borderRadius: "8px",
                    marginTop: "20px",
                  }}
                >
                  <strong>
                    ✓ This expense has been approved.
                  </strong>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )};


export default ManagerExpenses;
