const express = require("express");
const PORT = process.env.PORT || 4040;
const { handler } = require("./controller");

const app = express();
app.use(express.json());
app.post("/*", async (req, res) => {
  console.log(req.body);

  res.send(await handler(req));
});
app.get("/*", async (req, res) => {
  res.send(await handler(req));
});

console.log(app._router.stack.map(r => r.route && r.route.path).filter(Boolean));
app.listen(PORT, function (err) {
if (err) console.log(err);
console.log("Server listening on PORT", PORT);
});
