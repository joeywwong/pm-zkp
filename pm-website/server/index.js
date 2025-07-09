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
  const { type, attribute, schema, operatorStr, valueParam, tokenID, contextParam, attributeType } = req.body;
  if (!type || !attribute || !schema || operatorStr === undefined || valueParam === undefined || tokenID === undefined || contextParam === undefined || !attributeType) {
    return res.status(400).json({ error: "Missing one or more required fields in request body" });
  }

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
    tmpPath,
    operatorStr,
    valueParam,
    tokenID.toString(),
    contextParam,
    attributeType
  ];

  execFile("npx", args, { cwd: path.resolve(__dirname, "iden3_repo") }, (error, stdout, stderr) => {
    if (error) {
      // Try to parse error details from stderr or stdout
      let errorMsg = stderr || stdout || error.message;
      return res.status(500).json({ error: errorMsg });
    }
    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (e) {
      res.json({ output: stdout });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
