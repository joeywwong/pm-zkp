const express = require('express');
const { exec, execFile} = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;
//const { prepareRequestParams } = require('./iden3_repo/dist/prepareRequestParams');

app.use(cors());
app.use(express.json());

app.get('/api', (req, res) => {
  res.json({ message: 'Hello from Express!!!' });
});

app.post("/api/requestPayload", async (req, res) => {
  const { type, attribute, schema } = req.body;
  if (!type || !attribute || !schema) {
    return res.status(400).json({ error: "Missing type, attribute, or schema in request body" });
  }

  // Option A: Write schema to a temp file and pass its path
  const tmpPath = path.join(__dirname, "iden3_repo", `schema-${Date.now()}.json`);
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(schema, null, 2), "utf-8");
  } catch (err) {
    return res.status(500).json({ error: "Failed to write temp schema file" });
  }

  const args = [
    "hardhat",
    "--network", "polygon-amoy",
    "testRequest_with_go",
    type,
    attribute,
    tmpPath   // your task reads it via `fs.readFileSync(process.argv[5])`
  ];

  // execFile will avoid all shell-escaping issues
  execFile("npx", args, { cwd: path.resolve(__dirname, "iden3_repo") }, (err, stdout, stderr) => {
    // clean up temp file
    fs.unlinkSync(tmpPath);

    if (err) {
      console.error("error:", stderr);
      return res.status(500).json({ error: stderr });
    }
    try {
      // Parse the JSON output from the TypeScript script
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (e) {
      // If parsing fails, return raw output
      res.json({ output: stdout });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
