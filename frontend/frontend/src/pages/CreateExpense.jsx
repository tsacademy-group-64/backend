function CreateExpense() {
  return (
    <div>
      <h1>Create Expense</h1>

      <form>
        <div>
          <label>Expense Title</label>
          <br />
          <input
            type="text"
            placeholder="Enter expense title"
          />
        </div>

        <br />

        <div>
          <label>Amount</label>
          <br />
          <input
            type="number"
            placeholder="Enter amount"
          />
        </div>

        <br />

        <div>
          <label>Description</label>
          <br />
          <textarea
            placeholder="Enter expense description"
          />
        </div>

        <br />

        <button type="submit">
          Submit Expense
        </button>
      </form>
    </div>
  );
}

export default CreateExpense;