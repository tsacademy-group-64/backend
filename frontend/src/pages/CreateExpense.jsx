import { useState } from "react";

function CreateExpense() {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [receiptDetails, setReceiptDetails] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please login first");
      return;
    }

    const expense = {
      title,
      amount: Number(amount),
      category,
      expenseDate,
      description,
      receiptDetails,
    };

    try {
      const response = await fetch(
        "http://localhost:5000/api/expenses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(expense),
        }
      );

      const result = await response.json();

      console.log("Create expense response:", result);

      if (!response.ok) {
        alert(result.message || "Failed to create expense");
        return;
      }

      alert("Expense created successfully!");

      setTitle("");
      setAmount("");
      setCategory("");
      setExpenseDate("");
      setDescription("");
      setReceiptDetails("");
    } catch (error) {
      console.error("Create expense error:", error);
      alert("Unable to connect to server");
    }
  };

  return (
    <div className="page-container">
      <div
        className="card"
        style={{
          maxWidth: "700px",
          margin: "30px auto",
        }}
      >
        <h1>Create Expense</h1>

        <p style={{ color: "#666", marginBottom: "30px" }}>
          Submit a new expense for manager approval.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Expense Title */}

          <div className="form-group">
            <label>Expense Title</label>

            <input
              type="text"
              placeholder="Enter expense title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Amount */}

          <div className="form-group">
            <label>Amount (₦)</label>

            <input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              required
            />
          </div>

          {/* Category */}

          <div className="form-group">
            <label>Category</label>

            <input
              type="text"
              placeholder="e.g. Transport, Food, Office"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>

          {/* Expense Date */}

          <div className="form-group">
            <label>Expense Date</label>

            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>

          {/* Description */}

          <div className="form-group">
            <label>Description</label>

            <textarea
              placeholder="Enter a description of the expense"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="4"
            />
          </div>

          {/* Receipt Details */}

          <div className="form-group">
            <label>Receipt Details</label>

            <textarea
              placeholder="Enter receipt details"
              value={receiptDetails}
              onChange={(e) =>
                setReceiptDetails(e.target.value)
              }
              rows="4"
            />
          </div>

          {/* Submit */}

          <button
            type="submit"
            className="button primary-button"
            style={{
              width: "100%",
              fontSize: "16px",
              padding: "13px",
            }}
          >
            Submit Expense
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateExpense;

