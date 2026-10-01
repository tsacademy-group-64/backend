
import { useEffect, useState } from "react";

function Expenses() {
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

      console.log("Expenses response:", result);

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

  const deleteExpense = async (id) => {
    const token = localStorage.getItem("token");

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this expense?"
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/expenses/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      console.log("Delete response:", result);

      if (!response.ok) {
        alert(result.message || "Failed to delete expense");
        return;
      }

      alert("Expense deleted successfully!");

      fetchExpenses();
    } catch (error) {
      console.error("Delete expense error:", error);
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

  return (
    <div className="page-container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "25px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div>
          <h1>My Expenses</h1>

          <p style={{ color: "#666" }}>
            View and manage your submitted expenses.
          </p>
        </div>

        <div
          style={{
            background: "#dbeafe",
            color: "#1d4ed8",
            padding: "10px 16px",
            borderRadius: "20px",
            fontWeight: "bold",
          }}
        >
          {expenses.length} Expense
          {expenses.length !== 1 ? "s" : ""}
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="card">
          <h2>No expenses available</h2>

          <p style={{ color: "#666" }}>
            You have not submitted any expenses yet.
          </p>
        </div>
      ) : (
        <div>
          {expenses.map((expense) => (
            <div className="expense-card" key={expense._id}>
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
                {expense.receiptDetails || "No receipt details"}
              </p>

              {expense.status === "pending" && (
                <div
                  style={{
                    background: "#fef3c7",
                    padding: "15px",
                    borderRadius: "8px",
                    marginTop: "20px",
                  }}
                >
                  <p style={{ marginTop: 0 }}>
                    Your expense is waiting for manager approval.
                  </p>

                  <button
                    className="button danger-button"
                    onClick={() =>
                      deleteExpense(expense._id)
                    }
                  >
                    Delete Expense
                  </button>
                </div>
              )}

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
                    ✓ Your expense has been approved.
                  </strong>
                </div>
              )}

              {expense.status === "rejected" && (
                <div
                  style={{
                    background: "#fee2e2",
                    padding: "15px",
                    borderRadius: "8px",
                    marginTop: "20px",
                  }}
                >
                  <p style={{ marginTop: 0 }}>
                    Your expense has been rejected.
                  </p>

                  <p>
                    <strong>Rejection Reason:</strong>{" "}
                    {expense.rejectionReason ||
                      "No reason provided"}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Expenses;




