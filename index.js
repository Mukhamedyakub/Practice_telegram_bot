const express = require("express");
const { handler } = require("./controller");
const PORT = process.env.PORT || 4040;

const app = express();
app.use(express.json());

app.post("/*", async (req, res) => {
  try {
    console.log(req.body);
    const result = await handler(req, "POST");
    res.status(200).json(result);
  } catch (err) {
    console.error("POST handler error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

app.get("/*", async (req, res) => {
  try {
    const result = await handler(req, "GET");
    res.status(200).json(result);
  } catch (err) {
    console.error("GET handler error:", err);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log("Server listening on PORT", PORT);
});
